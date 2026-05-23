#!/usr/bin/env node
/**
 * DSLinter CLI: mode routing (dev / report / watch / build) + scanner (NAPI or DSLINTER_BIN).
 */
import { parseDslinterArgs } from "./lib/parse-args.mjs";
import {
  promoteScanToProjectRoot,
  withScannerScanPath,
} from "./lib/resolve-project.mjs";
import { logScanRootPromotion } from "./lib/project-root.mjs";
import { runScannerInternal } from "./lib/run-scanner.mjs";
import { runBuildMode } from "./modes/build.mjs";
import { runDevMode } from "./modes/dev.mjs";
import { runInitMode } from "./modes/init.mjs";
import { runReportMode } from "./modes/report.mjs";

const rawArgs = process.argv.slice(2);

if (rawArgs[0] === "init") {
  runInitMode({ argv: rawArgs.slice(1) });
  process.exit(0);
}

if (process.env.DSLINTER_INTERNAL === "1") {
  runScannerInternal(rawArgs);
}

if (rawArgs.includes("--version") || rawArgs.includes("-V")) {
  runScannerInternal(["--version"]);
}

if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
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
const promoted = promoteScanToProjectRoot(parsed.scanPath);
logScanRootPromotion(promoted);
const scannerArgs = withScannerScanPath(parsed.scannerArgs, promoted.scanPath);
const runParsed = { ...parsed, scanPath: promoted.scanPath, scannerArgs };

switch (mode) {
  case "dev":
    await runDevMode(runParsed);
    break;
  case "report":
    runReportMode(["--report", ...scannerArgs]);
    break;
  case "watch":
    runScannerInternal(["--watch", ...scannerArgs]);
    break;
  case "scanner":
    runScannerInternal(scannerArgs);
    break;
  case "build":
    await runBuildMode(runParsed);
    break;
  default:
    process.stderr.write(`dslinter: unknown mode ${mode}\n`);
    process.exit(1);
}
