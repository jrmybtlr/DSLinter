/**
 * Post-scan enrichment: fill playground prop kinds/options from TypeScript.
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createCheckerProgram,
  inferDeclaredPropsFromTsx,
  inferPlaygroundPropMetadata,
} from "./infer-prop-types-from-ts.mjs";

/**
 * @param {Record<string, unknown>} report
 * @param {string} projectRoot
 * @returns {boolean} true when any playground row changed
 */
export function enrichWorkspaceReport(report, projectRoot) {
  const playgrounds = report.playgrounds;
  if (!Array.isArray(playgrounds) || playgrounds.length === 0) return false;

  const checkerBundle = createCheckerProgram(projectRoot);
  if (!checkerBundle) return false;

  const { program, checker } = checkerBundle;
  let changed = false;

  for (const spec of playgrounds) {
    if (!spec || typeof spec !== "object") continue;

    let declaredProps = Array.isArray(spec.declared_props) ? [...spec.declared_props] : [];
    const relPath = typeof spec.rel_path === "string" ? spec.rel_path : "";
    const exportName = typeof spec.export_name === "string" ? spec.export_name : spec.id;

    if (typeof exportName !== "string" || !relPath) continue;

    const inferred = inferDeclaredPropsFromTsx(projectRoot, relPath, exportName);
    if (inferred.length && (!declaredProps.length || inferred.length > declaredProps.length)) {
      declaredProps = inferred;
      spec.declared_props = declaredProps;
      changed = true;
    }

    const before = JSON.stringify({
      kinds: spec.declared_prop_kinds ?? {},
      options: spec.declared_prop_options ?? {},
      defaults: spec.declared_prop_defaults ?? {},
    });

    const meta = inferPlaygroundPropMetadata(
      checker,
      program,
      projectRoot,
      relPath,
      exportName,
      declaredProps,
      {
        declared_prop_kinds: spec.declared_prop_kinds,
        declared_prop_options: spec.declared_prop_options,
        declared_prop_defaults: spec.declared_prop_defaults,
      },
    );

    if (Object.keys(meta.declared_prop_kinds).length) {
      spec.declared_prop_kinds = meta.declared_prop_kinds;
    }
    if (Object.keys(meta.declared_prop_options).length) {
      spec.declared_prop_options = meta.declared_prop_options;
    }
    if (Object.keys(meta.declared_prop_defaults).length) {
      spec.declared_prop_defaults = meta.declared_prop_defaults;
    }

    const after = JSON.stringify({
      kinds: spec.declared_prop_kinds ?? {},
      options: spec.declared_prop_options ?? {},
      defaults: spec.declared_prop_defaults ?? {},
    });
    if (before !== after) changed = true;
  }

  return changed;
}

/**
 * @param {string} reportPath
 * @param {string} projectRoot
 * @returns {boolean}
 */
export function enrichReportFile(reportPath, projectRoot) {
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    return false;
  }

  const changed = enrichWorkspaceReport(report, projectRoot);
  if (!changed) return false;

  const json = `${JSON.stringify(report, null, 2)}\n`;
  const dir = dirname(reportPath);
  const tmp = join(dir, `.dslinter-enrich-${process.pid}.tmp`);
  writeFileSync(tmp, json);
  renameSync(tmp, reportPath);
  return true;
}

/**
 * @param {string} reportPath
 * @param {string} projectRoot
 */
export function enrichReportFileBestEffort(reportPath, projectRoot) {
  try {
    enrichReportFile(reportPath, projectRoot);
  } catch (err) {
    if (process.env.DSLINTER_QUIET !== "1") {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`dslinter: TS playground enrich skipped (${msg})\n`);
    }
  }
}

/** @typedef {{ projectRoot: string; reportPath: string; logPrefix?: string }} EnrichOptions */

/**
 * CLI-facing enrichment used by report, build, dev, and watch modes.
 *
 * @param {EnrichOptions} opts
 * @returns {Promise<boolean>} true when enrichment ran and wrote the report
 */
export async function enrichPlaygroundsFromTs({
  projectRoot,
  reportPath,
  logPrefix = "dslinter",
}) {
  if (!createCheckerProgram(projectRoot)) {
    if (process.env.DSLINTER_DEBUG?.trim() === "1") {
      process.stderr.write(
        `${logPrefix}: skip playground TS enrichment (no tsconfig.json)\n`,
      );
    }
    return false;
  }

  try {
    return enrichReportFile(reportPath, projectRoot);
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
 * Poll the report file and re-run TS enrichment after the scanner writes JSON.
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
