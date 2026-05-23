import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCheckerProgram,
  enrichPlaygroundsFromReport,
} from "../../src/playground/inferPropTypesFromTs.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @typedef {{ projectRoot: string; reportPath: string; logPrefix?: string }} EnrichOptions */

/**
 * @param {EnrichOptions} opts
 * @returns {Promise<boolean>} true when enrichment ran and wrote the report
 */
export async function enrichPlaygroundsFromTs({
  projectRoot,
  reportPath,
  logPrefix = "dslinter",
}) {
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    return false;
  }

  if (!report.playgrounds?.length) return false;

  const bundle = createCheckerProgram(projectRoot);
  if (!bundle) {
    if (process.env.DSLINTER_DEBUG?.trim() === "1") {
      process.stderr.write(
        `${logPrefix}: skip playground TS enrichment (no tsconfig.json)\n`,
      );
    }
    return false;
  }

  try {
    enrichPlaygroundsFromReport(
      report,
      bundle.checker,
      bundle.program,
      projectRoot,
    );
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return true;
  } catch (err) {
    if (process.env.DSLINTER_DEBUG?.trim() === "1") {
      process.stderr.write(
        `${logPrefix}: skip playground TS enrichment (${err instanceof Error ? err.message : err})\n`,
      );
    }
    return false;
  }
}

/**
 * Poll the report file and re-run TS enrichment after Rust writes JSON.
 * Used by dev/watch modes where the scanner keeps running.
 *
 * @param {EnrichOptions & { pollMs?: number }} opts
 * @returns {() => void} stop function
 */
export function watchEnrichPlaygroundsFromTs({
  projectRoot,
  reportPath,
  logPrefix = "dslinter",
  pollMs = 300,
}) {
  let lastMtimeMs = 0;
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const { statSync } = await import("node:fs");
      let mtimeMs;
      try {
        mtimeMs = statSync(reportPath).mtimeMs;
      } catch {
        return;
      }
      if (mtimeMs <= lastMtimeMs) return;
      lastMtimeMs = mtimeMs;
      await enrichPlaygroundsFromTs({ projectRoot, reportPath, logPrefix });
    } finally {
      running = false;
    }
  };

  const interval = setInterval(() => {
    void tick();
  }, pollMs);
  void tick();

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
