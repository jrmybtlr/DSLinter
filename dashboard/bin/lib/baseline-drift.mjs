/**
 * Shared MCP/CLI baseline drift helpers.
 * Baseline path: `{projectRoot}/.dslinter/mcp-baseline.json`
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * @typedef {{
 *   design_system_health: number;
 *   ux_consistency: number;
 *   accessibility: number;
 *   maintainability: number;
 *   token_adoption?: number | null;
 * }} GovernanceScores
 */

/**
 * @typedef {{
 *   scores: GovernanceScores;
 *   findings?: unknown[];
 * }} DriftReport
 */

/**
 * @typedef {{
 *   hash: string;
 *   saved_at: string;
 *   scores: GovernanceScores;
 *   finding_count: number;
 * }} BaselineStore
 */

/**
 * @typedef {{
 *   baseline: { saved_at: string; scores: GovernanceScores; finding_count: number } | null;
 *   current: { scores: GovernanceScores; finding_count: number };
 *   score_deltas: Record<string, number>;
 *   finding_delta: number;
 * }} DriftSummary
 */

/** @param {string} projectRoot */
export function baselinePath(projectRoot) {
  return join(projectRoot, ".dslinter", "mcp-baseline.json");
}

/**
 * @param {string} projectRoot
 * @returns {Promise<BaselineStore | null>}
 */
export async function loadBaseline(projectRoot) {
  try {
    const raw = await readFile(baselinePath(projectRoot), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {DriftReport} report
 */
export function reportHash(report) {
  return createHash("sha256").update(JSON.stringify(report)).digest("hex");
}

/**
 * @param {string} projectRoot
 * @param {DriftReport} report
 * @param {string} [hash]
 */
export async function saveBaseline(projectRoot, report, hash) {
  const dir = join(projectRoot, ".dslinter");
  await mkdir(dir, { recursive: true });
  /** @type {BaselineStore} */
  const payload = {
    hash: hash ?? reportHash(report),
    saved_at: new Date().toISOString(),
    scores: report.scores,
    finding_count: report.findings?.length ?? 0,
  };
  await writeFile(baselinePath(projectRoot), JSON.stringify(payload, null, 2));
  return payload;
}

/**
 * @param {DriftReport} report
 * @param {BaselineStore | null} baseline
 * @returns {DriftSummary}
 */
export function computeDrift(report, baseline) {
  const currentCount = report.findings?.length ?? 0;
  /** @type {Record<string, number>} */
  const score_deltas = {
    design_system_health:
      report.scores.design_system_health -
      (baseline?.scores.design_system_health ?? report.scores.design_system_health),
    ux_consistency:
      report.scores.ux_consistency -
      (baseline?.scores.ux_consistency ?? report.scores.ux_consistency),
    accessibility:
      report.scores.accessibility -
      (baseline?.scores.accessibility ?? report.scores.accessibility),
    maintainability:
      report.scores.maintainability -
      (baseline?.scores.maintainability ?? report.scores.maintainability),
  };
  if (
    report.scores.token_adoption != null ||
    baseline?.scores.token_adoption != null
  ) {
    const cur = report.scores.token_adoption ?? 0;
    const base = baseline?.scores.token_adoption ?? cur;
    score_deltas.token_adoption = cur - base;
  }

  return {
    baseline: baseline
      ? {
          saved_at: baseline.saved_at,
          scores: baseline.scores,
          finding_count: baseline.finding_count,
        }
      : null,
    current: { scores: report.scores, finding_count: currentCount },
    score_deltas,
    finding_delta: currentCount - (baseline?.finding_count ?? currentCount),
  };
}

/**
 * @param {DriftSummary} drift
 * @param {{
 *   maxFindingDelta?: number;
 *   maxScoreDrop?: number;
 * }} [opts]
 * @returns {{ ok: boolean; reasons: string[] }}
 */
export function evaluateDriftFailure(drift, opts = {}) {
  const maxFindingDelta = opts.maxFindingDelta ?? 0;
  const maxScoreDrop = opts.maxScoreDrop ?? 0;
  /** @type {string[]} */
  const reasons = [];

  if (drift.baseline == null) {
    reasons.push("no baseline found (run with --update-baseline first)");
    return { ok: false, reasons };
  }

  if (drift.finding_delta > maxFindingDelta) {
    reasons.push(
      `finding_delta ${drift.finding_delta} exceeds max ${maxFindingDelta}`,
    );
  }

  for (const [pillar, delta] of Object.entries(drift.score_deltas)) {
    if (typeof delta === "number" && delta < -maxScoreDrop) {
      reasons.push(
        `${pillar} dropped by ${-delta} (max allowed drop ${maxScoreDrop})`,
      );
    }
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Strip Node-only drift flags from scanner argv; return remaining + parsed options.
 * @param {string[]} scannerArgs
 */
export function extractDriftFlags(scannerArgs) {
  /** @type {string[]} */
  const rest = [];
  let diffBaseline = false;
  let updateBaseline = false;
  let failOnDrift = false;
  /** @type {number | null} */
  let maxFindingDelta = null;
  /** @type {number | null} */
  let maxScoreDrop = null;
  /** @type {string | null} */
  let baselineFile = null;

  for (let i = 0; i < scannerArgs.length; i++) {
    const arg = scannerArgs[i];
    if (arg === "--diff-baseline") {
      diffBaseline = true;
      continue;
    }
    if (arg === "--update-baseline") {
      updateBaseline = true;
      continue;
    }
    if (arg === "--fail-on-drift") {
      failOnDrift = true;
      continue;
    }
    if (arg === "--max-finding-delta") {
      maxFindingDelta = Number.parseInt(scannerArgs[++i] ?? "", 10);
      continue;
    }
    if (arg?.startsWith("--max-finding-delta=")) {
      maxFindingDelta = Number.parseInt(arg.slice("--max-finding-delta=".length), 10);
      continue;
    }
    if (arg === "--max-score-drop") {
      maxScoreDrop = Number.parseInt(scannerArgs[++i] ?? "", 10);
      continue;
    }
    if (arg?.startsWith("--max-score-drop=")) {
      maxScoreDrop = Number.parseInt(arg.slice("--max-score-drop=".length), 10);
      continue;
    }
    if (arg === "--baseline") {
      baselineFile = scannerArgs[++i] ?? null;
      continue;
    }
    if (arg?.startsWith("--baseline=")) {
      baselineFile = arg.slice("--baseline=".length);
      continue;
    }
    rest.push(arg);
  }

  return {
    scannerArgs: rest,
    diffBaseline,
    updateBaseline,
    failOnDrift,
    maxFindingDelta: Number.isFinite(maxFindingDelta) ? maxFindingDelta : null,
    maxScoreDrop: Number.isFinite(maxScoreDrop) ? maxScoreDrop : null,
    baselineFile,
  };
}
