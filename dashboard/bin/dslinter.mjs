#!/usr/bin/env node
/**
 * DSLinter CLI: mode routing (dev / report / watch / build) + scanner (NAPI or DSLINTER_BIN).
 */
import { parseDslinterArgs } from "./lib/parse-args.mjs";
import { withScannerScanPath } from "./lib/resolve-project.mjs";
import { logScanScopeHint } from "./lib/project-root.mjs";
import { defaultReportPath } from "./lib/project-root.mjs";
import { runScannerInternal } from "./lib/run-scanner.mjs";
import { runBuildMode } from "./modes/build.mjs";
import { runDevMode } from "./modes/dev.mjs";
import { runExplorerMode } from "./modes/explore.mjs";
import { runWatchMode } from "./modes/watch.mjs";
import { runInitMode } from "./modes/init.mjs";
import { runMcpMode } from "./modes/mcp.mjs";
import { runReportMode } from "./modes/report.mjs";

const rawArgs = process.argv.slice(2);

if (rawArgs[0] === "init") {
  runInitMode({ argv: rawArgs.slice(1) });
  process.exit(0);
}

if (rawArgs[0] === "mcp") {
  await runMcpMode({ argv: rawArgs.slice(1) });
}

if (process.env.DSLINTER_INTERNAL === "1") {
  runScannerInternal(rawArgs);
}

if (rawArgs.includes("--version") || rawArgs.includes("-V")) {
  runScannerInternal(["--version"]);
}

if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
  process.stdout.write(
    "DSLinter explorer: npx dslinter [PATH] [--app APP]\nDefault: discover the workspace and start the interactive catalog.\n--app selects a Vite app by workspace path or package name.\ninit creates one optional preview adapter; init --legacy keeps the original registry scaffolding.\n\n",
  );
  runScannerInternal(["--help"]);
}

let parsed;
try {
  parsed = parseDslinterArgs(rawArgs);
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
}

const { mode } = parsed;
logScanScopeHint({
  scanPath: parsed.scanPath,
  projectRoot: parsed.projectRoot,
  explicitScanPath: parsed.explicitScanPath,
});
const scannerArgs = withScannerScanPath(parsed.scannerArgs, parsed.scanPath);
const runParsed = { ...parsed, scannerArgs };

switch (mode) {
  case "dev":
    if (process.env.DSLINTER_USE_CONSUMER_VITE === "1") await runDevMode(runParsed);
    else await runExplorerMode(runParsed);
    break;
  case "report":
    await runReportMode({
      scanPath: runParsed.scanPath,
      projectRoot: runParsed.projectRoot,
      outputPath: runParsed.outputPath,
      scannerArgs: runParsed.scannerArgs,
    });
    break;
  case "watch":
    await runWatchMode(runParsed);
    break;
  case "scanner":
    process.env.DSLINTER_PROJECT_ROOT = runParsed.projectRoot;
    runScannerInternal(
      runParsed.outputPath
        ? scannerArgs
        : [...scannerArgs, "--output", defaultReportPath(runParsed.scanPath, null)],
    );
    break;
  case "build":
    await runBuildMode(runParsed);
    break;
  default:
    process.stderr.write(`dslinter: unknown mode ${mode}\n`);
    process.exit(1);
}
