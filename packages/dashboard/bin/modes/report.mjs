import { resolve } from "node:path";
import { defaultReportPath } from "../lib/project-root.mjs";
import { enrichReportFileBestEffort } from "../lib/enrich-playgrounds-from-ts.mjs";
import { runScannerSync } from "../lib/run-scanner.mjs";

/**
 * @param {string[]} scannerArgs
 * @param {{ scanPath: string; projectRoot: string; outputPath: string | null }} context
 */
export function runReportMode(scannerArgs, context) {
  const reportPath = defaultReportPath(resolve(context.scanPath), context.outputPath);
  const code = runScannerSync(scannerArgs, { projectRoot: context.projectRoot });
  if (code !== 0) process.exit(code);
  enrichReportFileBestEffort(reportPath, context.projectRoot);
}
