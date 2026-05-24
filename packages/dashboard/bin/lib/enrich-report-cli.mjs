#!/usr/bin/env node
/**
 * CLI entry for Rust watch post-write hook and manual enrichment.
 * Usage: node enrich-report-cli.mjs <reportPath> <projectRoot>
 */
import { enrichReportFileBestEffort } from "./enrich-playgrounds-from-ts.mjs";

const [reportPath, projectRoot] = process.argv.slice(2);
if (!reportPath || !projectRoot) {
  process.stderr.write("usage: enrich-report-cli.mjs <reportPath> <projectRoot>\n");
  process.exit(1);
}

enrichReportFileBestEffort(reportPath, projectRoot);
