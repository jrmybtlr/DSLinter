#!/usr/bin/env node
/**
 * DSLinter CLI: mode routing (dev / report / watch / build) + scanner (NAPI or DSLINT_BIN).
 */
import { parseDslinterArgs } from "./lib/parse-args.mjs";
import { runScannerInternal } from "./lib/run-scanner.mjs";
import { runBuildMode } from "./modes/build.mjs";
import { runDevMode } from "./modes/dev.mjs";
import { runInitMode } from "./modes/init.mjs";
import { runReportMode } from "./modes/report.mjs";

const rawArgs = process.argv.slice(2);

if (rawArgs[0] === "init") {
  runInitMode({ targetDir: rawArgs[1] });
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

const { mode, scannerArgs } = parsed;

switch (mode) {
  case "dev":
    await runDevMode(parsed);
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
    runBuildMode(parsed);
    break;
  default:
    process.stderr.write(`dslinter: unknown mode ${mode}\n`);
    process.exit(1);
}
