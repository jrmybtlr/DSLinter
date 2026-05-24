/**
 * Legacy demo helper — delegates TS playground enrichment to the shared CLI module.
 * Prefer `dslinter . --report` which enriches automatically.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enrichWorkspaceReport } from "../../packages/dashboard/bin/lib/enrich-playgrounds-from-ts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoRoot = join(__dirname, "..");
const reportPath = join(demoRoot, "public/dslinter-report.json");

function patchLegacyComponentPathsInReport(report) {
  const raw = JSON.stringify(report);
  const next = raw
    .replaceAll("src/components/bad/duplicate/", "src/components/duplicate/")
    .replaceAll("src/components/good/", "src/components/")
    .replaceAll("src/components/bad/", "src/components/");
  return JSON.parse(next);
}

const report = patchLegacyComponentPathsInReport(JSON.parse(readFileSync(reportPath, "utf8")));

if (!Array.isArray(report.playgrounds) || report.playgrounds.length === 0) {
  console.warn("merge-playgrounds: no playgrounds in report — run dslinter scan first");
  process.exit(0);
}

const changed = enrichWorkspaceReport(report, demoRoot);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Wrote ${reportPath} (${report.playgrounds.length} playgrounds${changed ? ", enriched from TS" : ""})`,
);
