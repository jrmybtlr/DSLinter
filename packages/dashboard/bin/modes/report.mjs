import { runScannerSync } from "../lib/run-scanner.mjs";

/**
 * @param {string[]} scannerArgs
 */
export function runReportMode(scannerArgs) {
  const code = runScannerSync(scannerArgs);
  process.exit(code);
}
