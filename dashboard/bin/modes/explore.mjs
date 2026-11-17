import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultReportPath } from "../lib/project-root.mjs";
import { spawnScanner } from "../lib/run-scanner.mjs";
import { findAvailablePort } from "../lib/port-check.mjs";
import { discoverApps, selectApp } from "../lib/workspace.mjs";
import { workspaceCacheDir } from "../lib/cache.mjs";
import { resolveServePort } from "../lib/constants.mjs";

export async function runExplorerMode(options) {
  const { scanPath, outputPath, scannerArgs, app: requestedApp } = options;
  const apps = discoverApps(scanPath);
  const selected = selectApp(apps, requestedApp);
  const apiPort = await findAvailablePort(options.servePort || resolveServePort());
  const uiPort = await findAvailablePort(Number(process.env.DSLINTER_DEV_UI_PORT) || 5175);
  const reportPath = defaultReportPath(scanPath, outputPath);
  const args = [...scannerArgs, "--serve", String(apiPort)];
  if (!outputPath) args.push("--output", reportPath);
  const scanner = await spawnScanner(args, {
    projectRoot: scanPath,
    env: {
      ...process.env,
      DSLINTER_QUIET: "1",
      DSLINTER_PROJECT_ROOT: scanPath,
      DSLINTER_ENRICH_SCRIPT: "",
      DSLINTER_SKIP_TS_ENRICH: "1",
    },
  });
  const metadata = spawn(
    process.execPath,
    [fileURLToPath(new URL("../lib/catalog-worker.mjs", import.meta.url)), reportPath, scanPath],
    { stdio: "inherit" },
  );
  const server = spawn(
    process.execPath,
    ["--import", "tsx", fileURLToPath(new URL("../../vite/explorerServer.ts", import.meta.url))],
    {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      env: {
        ...process.env,
        DSLINTER_SCAN_ROOT: scanPath,
        DSLINTER_REPORT_PATH: reportPath,
        DSLINTER_SERVE_PORT: String(apiPort),
        DSLINTER_DEV_UI_PORT: String(uiPort),
        DSLINTER_CACHE_PATH: workspaceCacheDir(scanPath),
        DSLINTER_APPS: JSON.stringify(apps),
        DSLINTER_SELECTED_APP: selected?.id || "",
      },
    },
  );
  let stopping = false;
  function cleanup() {
    if (stopping) return;
    stopping = true;
    scanner.kill("SIGTERM");
    metadata.kill("SIGTERM");
    server.kill("SIGTERM");
  }
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(signal, cleanup);
  for (const child of [scanner, server, metadata]) {
    child.once("exit", (code, signal) => {
      if (!stopping) process.exitCode = code ?? (signal ? 1 : 0);
      cleanup();
    });
    child.once("error", (error) => {
      process.stderr.write(`dslinter: ${error.message}\n`);
      if (!stopping) process.exitCode = 1;
      cleanup();
    });
  }
  process.stderr.write(
    `\nDSLinter · ${scanPath}\nDashboard: http://127.0.0.1:${uiPort}/\nCache: ${workspaceCacheDir(scanPath)}\n`,
  );
  if (apps.length > 1)
    process.stderr.write(
      `Preview app: ${selected?.name} (switch apps in the explorer or use --app)\n`,
    );
  server.once("message", (message) => {
    if (message?.type !== "ready" || process.env.DSLINTER_OPEN_BROWSER === "0") return;
    const url = `http://127.0.0.1:${uiPort}/`;
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "rundll32"
          : "xdg-open";
    const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
    spawn(command, args, { stdio: "ignore" }).on("error", () => {});
  });
}
