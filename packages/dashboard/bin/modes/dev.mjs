import { spawn, spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import {
  defaultReportPath,
  defaultServePort,
  findViteRoot,
  getDashboardPackageRoot,
  hasEmbedDashboard,
  resolveBundledDashboardDir,
  resolveViteBin,
} from "../lib/project-root.mjs";
import { writeDevBanner } from "../lib/dev-banner.mjs";
import { watchEnrichPlaygroundsFromTs } from "../lib/enrich-playgrounds-from-ts.mjs";
import { findAvailablePort, warnIfPortBusy } from "../lib/port-check.mjs";
import { spawnScanner } from "../lib/run-scanner.mjs";
import { shouldUseConsumerViteDev } from "../lib/scan-host.mjs";
import { ensureMinimalSetup } from "../lib/setup-readiness.mjs";
import { waitForPort } from "../lib/wait-for-port.mjs";

const POLL_MS = 150;

/**
 * @param {number} preferred
 */
async function resolveUiPort(preferred) {
  const fromEnv = process.env.DSLINTER_DEV_UI_PORT?.trim();
  const start = fromEnv
    ? Number.parseInt(fromEnv, 10)
    : preferred;
  if (!Number.isFinite(start) || start < 1 || start > 65535) {
    return findAvailablePort(preferred);
  }
  return findAvailablePort(start);
}

/**
 * @param {{
 *   scanPath: string;
 *   reportPath: string;
 *   apiPort: number;
 *   apiAvailable: boolean;
 *   dashboardUrl?: string | null;
 *   bundledUrl?: string | null;
 *   projectRoot: string;
 * }} banner
 */
function printDevBanner(banner) {
  writeDevBanner({ ...banner, pollMs: POLL_MS });
}

/**
 * @param {{
 *   scanPath: string;
 *   projectRoot: string;
 *   outputPath: string | null;
 *   scannerArgs: string[];
 *   servePort: number | null;
 *   yes?: boolean;
 *   explicitScanPath?: string | null;
 * }}
 */
export async function runDevMode({
  scanPath,
  projectRoot,
  outputPath,
  scannerArgs,
  servePort,
  yes = false,
}) {
  const port = servePort ?? defaultServePort();
  const scanAbs = resolve(scanPath);
  const projectAbs = resolve(projectRoot);
  const reportPath = defaultReportPath(scanAbs, outputPath);

  await ensureMinimalSetup({
    targetDir: projectAbs,
    reportPath,
    yes,
  });

  const consumerViteRoot = findViteRoot(scanAbs);
  const embedRoot = getDashboardPackageRoot();
  const embedViteBin = hasEmbedDashboard() ? resolveViteBin(embedRoot) : null;

  const useConsumerViteDev =
    consumerViteRoot != null && shouldUseConsumerViteDev(scanAbs);

  const useEmbedViteDev =
    embedViteBin != null &&
    !useConsumerViteDev &&
    process.env.DSLINTER_NO_EMBED_VITE?.trim() !== "1";

  const bundledDist =
    useEmbedViteDev || useConsumerViteDev
      ? null
      : resolveBundledDashboardDir();

  const args = [...scannerArgs];
  const hasServe = args.some((a) => a === "--serve" || a.startsWith("--serve="));
  if (!hasServe) {
    args.push("--serve", String(port));
  }
  if (!args.some((a) => a === "--output" || a.startsWith("--output="))) {
    args.push("--output", reportPath);
  }

  const hasDashboardStaticFlag = args.some(
    (a) => a === "--dashboard-static" || a.startsWith("--dashboard-static="),
  );
  const attachBundledStatic =
    bundledDist != null && !useEmbedViteDev && !hasDashboardStaticFlag;

  if (attachBundledStatic) {
    args.push("--dashboard-static", bundledDist);
  }

  const apiAvailable = !(await warnIfPortBusy(port, { silent: true }));

  const stopEnrich = watchEnrichPlaygroundsFromTs({
    projectRoot: projectAbs,
    reportPath,
  });

  const scanner = await spawnScanner(args, {
    projectRoot: projectAbs,
    env: {
      ...process.env,
      DSLINTER_QUIET: "1",
      DSLINTER_PROJECT_ROOT: projectAbs,
    },
  });
  const children = [scanner];

  const cleanup = (signal) => {
    stopEnrich();
    for (const child of children) {
      if (child && !child.killed) child.kill(signal);
    }
  };

  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => cleanup(sig));
  }

  scanner.on("exit", (code, signal) => {
    if (signal) cleanup("SIGTERM");
    else if (code !== 0 && code !== null) process.exit(code);
  });

  if (apiAvailable) {
    try {
      await waitForPort(port);
    } catch (err) {
      process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
      cleanup("SIGTERM");
      process.exit(1);
    }
  }

  const bundledUrl = attachBundledStatic ? `http://127.0.0.1:${port}/` : null;

  const bannerBase = {
    scanPath: scanAbs,
    reportPath,
    apiPort: port,
    apiAvailable,
    bundledUrl,
    projectRoot: projectAbs,
  };

  const consumerViteRootForEnv = consumerViteRoot ?? findViteRoot(scanAbs);

  if (useEmbedViteDev) {
    const uiPort = await resolveUiPort(
      Number.parseInt(process.env.DSLINTER_DEV_UI_PORT?.trim() || "5175", 10) || 5175,
    );
    const dashboardUrl = `http://127.0.0.1:${uiPort}/`;

    const vite = spawn(
      process.execPath,
      [
        embedViteBin,
        "--config",
        join(embedRoot, "vite.config.ts"),
        "--mode",
        "serve",
        "--port",
        String(uiPort),
        "--strictPort",
      ],
      {
        cwd: embedRoot,
        stdio: "inherit",
        env: {
          ...process.env,
          DSLINTER_SERVE_PORT: String(port),
          DSLINTER_SCAN_ROOT: scanAbs,
          DSLINTER_REPORT_PATH: reportPath,
          ...(consumerViteRootForEnv
            ? { DSLINTER_CONSUMER_VITE_ROOT: consumerViteRootForEnv }
            : {}),
        },
      },
    );
    children.push(vite);
    printDevBanner(
      attachBundledStatic ? bannerBase : { ...bannerBase, dashboardUrl },
    );

    vite.on("exit", (code, signal) => {
      cleanup("SIGTERM");
      if (signal) process.kill(process.pid, signal);
      else process.exit(code ?? 0);
    });
    return;
  }

  if (useConsumerViteDev) {
    const viteBin = resolveViteBin(consumerViteRoot);
    if (!viteBin) {
      process.stderr.write(`dslinter: vite not installed in ${consumerViteRoot}. Run npm install.\n`);
      cleanup("SIGTERM");
      process.exit(1);
    }

    const uiPort = await resolveUiPort(5173);
    const dashboardUrl = `http://localhost:${uiPort}/`;

    const consumerConfig = join(
      getDashboardPackageRoot(),
      "vite",
      "consumer.config.mjs",
    );
    const vite = spawn(
      process.execPath,
      [
        viteBin,
        "--config",
        consumerConfig,
        "--mode",
        "serve",
        "--port",
        String(uiPort),
        "--strictPort",
      ],
      {
        cwd: consumerViteRoot,
        stdio: "inherit",
        env: {
          ...process.env,
          DSLINTER_SERVE_PORT: String(port),
          DSLINTER_SCAN_ROOT: scanAbs,
          DSLINTER_REPORT_PATH: reportPath,
          DSLINTER_VITE_ROOT: consumerViteRoot,
          DSLINTER_CONSUMER_VITE_ROOT: consumerViteRoot,
        },
      },
    );
    children.push(vite);
    printDevBanner(
      attachBundledStatic ? bannerBase : { ...bannerBase, dashboardUrl },
    );

    vite.on("exit", (code, signal) => {
      cleanup("SIGTERM");
      if (signal) process.kill(process.pid, signal);
      else process.exit(code ?? 0);
    });
    return;
  }

  if (bundledDist) {
    const openUrl = bundledUrl ?? `http://127.0.0.1:${port}/`;
    printDevBanner(bannerBase);
    maybeOpenBrowser(openUrl);
    scanner.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  printDevBanner(bannerBase);
  scanner.on("exit", (code) => process.exit(code ?? 0));
}

/**
 * @param {string} url
 */
function maybeOpenBrowser(url) {
  if (process.env.CI === "true" || process.env.CI === "1") return;
  if (process.env.DSLINTER_OPEN_BROWSER !== "1") return;

  const platform = process.platform;
  if (platform === "darwin") {
    spawnSync("open", [url], { stdio: "ignore" });
  } else if (platform === "win32") {
    spawnSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
  } else {
    spawnSync("xdg-open", [url], { stdio: "ignore" });
  }
}
