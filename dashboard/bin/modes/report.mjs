import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defaultReportPath } from "../lib/project-root.mjs";
import { enrichPlaygroundsFromTs } from "../lib/enrich-playgrounds-from-ts.mjs";
import { runScannerSync } from "../lib/run-scanner.mjs";
import {
  baselinePath,
  computeDrift,
  evaluateDriftFailure,
  extractDriftFlags,
  loadBaseline,
  saveBaseline,
} from "../lib/baseline-drift.mjs";

/**
 * @param {{
 *   scanPath: string;
 *   projectRoot: string;
 *   outputPath: string | null;
 *   scannerArgs: string[];
 * }} opts
 */
export async function runReportMode({ scanPath, projectRoot, outputPath, scannerArgs }) {
  const driftOpts = extractDriftFlags(scannerArgs);
  const reportPath = defaultReportPath(scanPath, outputPath);
  const args = ["--report", ...driftOpts.scannerArgs];
  if (!args.some((a) => a === "--output" || a.startsWith("--output="))) {
    args.push("--output", reportPath);
  }

  const code = runScannerSync(args);
  if (code !== 0) process.exit(code);

  const projectAbs = resolve(projectRoot);
  await enrichPlaygroundsFromTs({
    projectRoot: projectAbs,
    reportPath,
  });

  const needsDrift = driftOpts.diffBaseline || driftOpts.updateBaseline || driftOpts.failOnDrift;

  if (!needsDrift) {
    process.exit(0);
  }

  const raw = await readFile(reportPath, "utf8");
  const report = JSON.parse(raw);

  if (driftOpts.updateBaseline) {
    await saveBaseline(projectAbs, report);
    process.stderr.write(`dslinter: wrote baseline ${baselinePath(projectAbs)}\n`);
  }

  let baseline = null;
  if (driftOpts.baselineFile) {
    try {
      baseline = JSON.parse(await readFile(resolve(driftOpts.baselineFile), "utf8"));
    } catch (err) {
      process.stderr.write(
        `dslinter: could not load --baseline ${driftOpts.baselineFile}: ${err instanceof Error ? err.message : err}\n`,
      );
      process.exit(1);
    }
  } else {
    baseline = await loadBaseline(projectAbs);
  }

  const drift = computeDrift(report, baseline);

  if (driftOpts.diffBaseline || driftOpts.failOnDrift) {
    process.stdout.write(`${JSON.stringify(drift, null, 2)}\n`);
  }

  if (driftOpts.failOnDrift) {
    const result = evaluateDriftFailure(drift, {
      maxFindingDelta: driftOpts.maxFindingDelta ?? 0,
      maxScoreDrop: driftOpts.maxScoreDrop ?? 0,
    });
    if (!result.ok) {
      for (const reason of result.reasons) {
        process.stderr.write(`dslinter: drift fail: ${reason}\n`);
      }
      process.exit(1);
    }
  }

  process.exit(0);
}
