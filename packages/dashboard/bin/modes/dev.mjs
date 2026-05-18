import { spawn, spawnSync } from "node:child_process";
import {
  defaultReportPath,
  defaultServePort,
  findViteRoot,
  resolveBundledDashboardDir,
  resolveViteBin,
} from "../lib/project-root.mjs";
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
  const viteRoot = findViteRoot(process.cwd());
  const bundledDist = viteRoot ? null : resolveBundledDashboardDir();

  const args = [...scannerArgs];
  const hasServe = args.some((a) => a === "--serve" || a.startsWith("--serve="));
  if (!hasServe) {
    args.push("--serve", String(port));
  }
  if (!args.some((a) => a === "--output" || a.startsWith("--output="))) {
    args.push("--output", reportPath);
  }
  if (bundledDist && !args.some((a) => a === "--dashboard-static" || a.startsWith("--dashboard-static="))) {
    args.push("--dashboard-static", bundledDist);
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

  if (bundledDist) {
    const url = `http://127.0.0.1:${port}/`;
    process.stderr.write(
      [
        "",
        "[dslinter] Bundled dashboard at",
        `  ${url}`,
        `  Report: http://127.0.0.1:${port}/dslint-report.json`,
        "",
      ].join("\n"),
    );
    maybeOpenBrowser(url);
    scanner.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  if (!viteRoot) {
    process.stderr.write(
      [
        "",
        "[dslinter] No vite.config.* and no bundled dashboard-dist — scanner only (watch + serve).",
        "  Reinstall dslinter or run `pnpm --filter dslinter run build:dashboard` from the repo.",
        "  Or add a Vite app with proxy for /dslint-report.json and /events.",
        `  Scanner: http://127.0.0.1:${port}/dslint-report.json`,
        "",
      ].join("\n"),
    );
    scanner.on("exit", (code) => process.exit(code ?? 0));
    return;
  }

  const viteBin = resolveViteBin(viteRoot);
  if (!viteBin) {
    process.stderr.write(`dslinter: vite not installed in ${viteRoot}. Run npm install.\n`);
    cleanup("SIGTERM");
    process.exit(1);
  }

  const vite = spawn(process.execPath, [viteBin, "--mode", "serve"], {
    cwd: viteRoot,
    stdio: "inherit",
  });
  children.push(vite);

  vite.on("exit", (code, signal) => {
    cleanup("SIGTERM");
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
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
