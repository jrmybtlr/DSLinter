import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  defaultReportPath,
  defaultServePort,
  findViteRoot,
  getDashboardPackageRoot,
  hasEmbedDashboard,
  resolveBundledDashboardDir,
  resolveViteBin,
} from "../lib/project-root.mjs";
import { warnIfPortBusy } from "../lib/port-check.mjs";
import { spawnScanner } from "../lib/run-scanner.mjs";
import { waitForPort } from "../lib/wait-for-port.mjs";

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

  if (hasServe || args.some((a) => a.startsWith("--serve="))) {
    await warnIfPortBusy(port);
  }

  const scanner = await spawnScanner(args);
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

  try {
    await waitForPort(port);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
    cleanup("SIGTERM");
    process.exit(1);
  }

  const apiUrl = `http://127.0.0.1:${port}/dslint-report.json`;

  if (useEmbedViteDev) {
    const uiPort = process.env.DSLINTER_DEV_UI_PORT?.trim() || "5175";
    const vite = spawn(
      process.execPath,
      [embedViteBin, "--config", join(embedRoot, "vite.config.ts"), "--mode", "serve", "--port", uiPort],
      {
        cwd: embedRoot,
        stdio: "inherit",
        env: { ...process.env, DSLINT_SERVE_PORT: String(port) },
      },
    );
    children.push(vite);
    process.stderr.write(
      [
        "",
        "[dslinter] Dashboard UI (live source)",
        `  http://127.0.0.1:${uiPort}/`,
        "[dslinter] Scanner API",
        `  ${apiUrl}`,
        `  SSE: http://127.0.0.1:${port}/events`,
        "",
      ].join("\n"),
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

    const bundledUrl = attachBundledStatic ? `http://127.0.0.1:${port}/` : null;
    process.stderr.write(
      [
        "",
        "[dslinter] Dashboard UI (recommended) — Vite dev server with live dslinter source:",
        "  http://localhost:5173/  (or the port Vite prints below if 5173 is taken)",
        bundledUrl
          ? `[dslinter] Bundled dashboard (same build as publish) — only if port ${port} bound successfully:`
          : `[dslinter] Scanner API only on :${port} (port may be busy — use Vite URL above):`,
        bundledUrl ? `  ${bundledUrl}` : null,
        `  ${apiUrl}`,
        `  SSE: http://127.0.0.1:${port}/events`,
        "",
        "  Do not use `npx dslint` — that is a different npm package. Use `npm run dev` or `npx dslinter .` in demo/.",
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    );

    const vite = spawn(process.execPath, [viteBin, "--mode", "serve"], {
      cwd: consumerViteRoot,
      stdio: "inherit",
      env: { ...process.env, DSLINT_SERVE_PORT: String(port) },
    });
    children.push(vite);

    vite.on("exit", (code, signal) => {
      cleanup("SIGTERM");
      if (signal) process.kill(process.pid, signal);
      else process.exit(code ?? 0);
    });
    return;
  }

  if (bundledDist) {
    const url = `http://127.0.0.1:${port}/`;
    process.stderr.write(
      [
        "",
        "[dslinter] Bundled dashboard",
        `  ${url}`,
        `  Report: ${apiUrl}`,
        "",
      ].join("\n"),
    );
    maybeOpenBrowser(url);
    scanner.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  process.stderr.write(
    [
      "",
      "[dslinter] Scanner only (no dashboard UI).",
      `  Report: ${apiUrl}`,
      "  Run `pnpm --filter dslinter run build:dashboard` or use a Vite project with dslinter.",
      "",
    ].join("\n"),
  );
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
