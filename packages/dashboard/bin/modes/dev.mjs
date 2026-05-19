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
import { findAvailablePort, warnIfPortBusy } from "../lib/port-check.mjs";
import { spawnScanner } from "../lib/run-scanner.mjs";
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
 * }} banner
 */
function printDevBanner(banner) {
  writeDevBanner({ ...banner, pollMs: POLL_MS });
}

/**
 * @param {{
 *   scanPath: string;
 *   outputPath: string | null;
 *   scannerArgs: string[];
 *   servePort: number | null;
 * }}
 */
export async function runDevMode({ scanPath, outputPath, scannerArgs, servePort }) {
  const port = servePort ?? defaultServePort();
  const reportPath = defaultReportPath(scanPath, outputPath);
  const scanAbs = resolve(scanPath);
  const consumerViteRoot = findViteRoot(process.cwd());
  const embedRoot = getDashboardPackageRoot();
  const embedViteBin = hasEmbedDashboard() ? resolveViteBin(embedRoot) : null;
  /** Live embed UI from source (proxies report/SSE to the scanner port). */
  const useEmbedViteDev =
    embedViteBin != null &&
    consumerViteRoot == null &&
    process.env.DSLINTER_NO_EMBED_VITE?.trim() !== "1";

  const bundledDist = useEmbedViteDev ? null : resolveBundledDashboardDir();

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

  const scanner = await spawnScanner(args, {
    env: {
      ...process.env,
      DSLINTER_QUIET: "1",
    },
  });
  const children = [scanner];

  const cleanup = (signal) => {
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
  };

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
          DSLINT_SERVE_PORT: String(port),
          DSLINT_SCAN_ROOT: scanAbs,
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

  if (consumerViteRoot) {
    const viteBin = resolveViteBin(consumerViteRoot);
    if (!viteBin) {
      process.stderr.write(`dslinter: vite not installed in ${consumerViteRoot}. Run npm install.\n`);
      cleanup("SIGTERM");
      process.exit(1);
    }

    const uiPort = await resolveUiPort(5173);
    const dashboardUrl = `http://localhost:${uiPort}/`;

    const vite = spawn(
      process.execPath,
      [viteBin, "--mode", "serve", "--port", String(uiPort), "--strictPort"],
      {
        cwd: consumerViteRoot,
        stdio: "inherit",
        env: {
          ...process.env,
          DSLINT_SERVE_PORT: String(port),
          DSLINT_SCAN_ROOT: scanAbs,
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
  if (process.env.DSLINT_OPEN_BROWSER !== "1") return;

  const platform = process.platform;
  if (platform === "darwin") {
    spawnSync("open", [url], { stdio: "ignore" });
  } else if (platform === "win32") {
    spawnSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
  } else {
    spawnSync("xdg-open", [url], { stdio: "ignore" });
  }
}
