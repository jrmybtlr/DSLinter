import { resolve } from "node:path";
import { defaultReportPath } from "../lib/project-root.mjs";
import { enrichPlaygroundsFromTs } from "../lib/enrich-playgrounds-from-ts.mjs";
import { runScannerSync } from "../lib/run-scanner.mjs";

/**
 * @param {{
 *   scanPath: string;
 *   projectRoot: string;
 *   outputPath: string | null;
 *   scannerArgs: string[];
 * }} opts
 */
export async function runReportMode({
  scanPath,
  projectRoot,
  outputPath,
  scannerArgs,
}) {
  const reportPath = defaultReportPath(scanPath, outputPath);
  const args = ["--report", ...scannerArgs];
  if (!args.some((a) => a === "--output" || a.startsWith("--output="))) {
    args.push("--output", reportPath);
  }

  const code = runScannerSync(args);
  if (code !== 0) process.exit(code);

  await enrichPlaygroundsFromTs({
    projectRoot: resolve(projectRoot),
    reportPath,
  });
  process.exit(0);
}
