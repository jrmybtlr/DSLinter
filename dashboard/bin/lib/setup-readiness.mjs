import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  detectDefaultIncludeDir,
  detectInitLayout,
  findDslintConfigPath,
  writeDslintConfig,
} from "./scaffold-config.mjs";
import { resolveProjectRoot } from "./resolve-project.mjs";
import { readEnv } from "./env.mjs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { confirmYesNo, isInteractiveTTY } from "./prompt.mjs";
import { defaultReportPath } from "./project-root.mjs";

/**
 * @typedef {"missing_config" | "missing_public"} SetupIssueKind
 */

/**
 * @typedef {{ kind: SetupIssueKind; label: string }} SetupIssue
 */

/**
 * @param {string} targetDir project / vite root
 * @param {string} reportPath absolute report file path
 * @returns {SetupIssue[]}
 */
export function assessSetupReadiness(targetDir, reportPath) {
  const root = resolve(targetDir);
  const issues = [];

  if (!findDslintConfigPath(root)) {
    issues.push({ kind: "missing_config", label: ".dslinter.json" });
  }

  const publicDir = dirname(resolve(reportPath));
  if (!existsSync(publicDir)) {
    issues.push({ kind: "missing_public", label: "public/" });
  }

  return issues;
}

/**
 * @param {string} reportPath
 */
export function ensurePublicDir(reportPath) {
  const publicDir = dirname(resolve(reportPath));
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }
}

/**
 * @param {{
 *   targetDir: string;
 *   reportPath: string;
 *   yes?: boolean;
 *   interactive?: boolean;
 * }} opts
 * @returns {Promise<{ applied: string[]; skipped: boolean }>}
 */
export async function ensureMinimalSetup(opts) {
  const targetDir = resolve(opts.targetDir);
  const reportPath = resolve(opts.reportPath);
  const noScaffold = readEnv("NO_SCAFFOLD") === "1";

  const issues = assessSetupReadiness(targetDir, reportPath);
  if (!issues.length || noScaffold) {
    if (issues.length && noScaffold) {
      process.stderr.write(
        `dslinter: setup incomplete (${issues.map((i) => i.label).join(", ")}). Set DSLINTER_NO_SCAFFOLD=0 or run with --yes to create.\n`,
      );
    }
    return { applied: [], skipped: noScaffold && issues.length > 0 };
  }

  const ci = process.env.CI === "true" || process.env.CI === "1";
  const autoYes = opts.yes === true || ci;
  const interactive = opts.interactive ?? isInteractiveTTY();

  let shouldApply = autoYes;
  if (!shouldApply && interactive) {
    process.stderr.write("dslinter: setup incomplete for live previews.\n");
    for (const issue of issues) {
      process.stderr.write(`  Missing: ${issue.label}\n`);
    }
    shouldApply = await confirmYesNo("Create these files now?");
  } else if (!shouldApply && !interactive) {
    process.stderr.write(
      `dslinter: setup incomplete (${issues.map((i) => i.label).join(", ")}). Run with --yes or use an interactive terminal.\n`,
    );
    return { applied: [], skipped: true };
  }

  if (!shouldApply) {
    process.stderr.write(
      "dslinter: continuing without scaffold — previews and governance may be limited.\n",
    );
    return { applied: [], skipped: true };
  }

  /** @type {string[]} */
  const applied = [];

  if (issues.some((i) => i.kind === "missing_config")) {
    const layout = detectInitLayout(targetDir);
    let includeDir = detectDefaultIncludeDir(targetDir, layout);
    if (interactive && includeDir) {
      const rl = createInterface({ input, output });
      try {
        const answer = (
          await rl.question(`Components directory [${includeDir}]: `)
        ).trim();
        if (answer) includeDir = answer;
      } finally {
        rl.close();
      }
    }
    const result = writeDslintConfig({
      targetDir,
      layout,
      ...(includeDir ? { includeDir } : {}),
    });
    applied.push(result.path);
    process.stderr.write(`dslinter: created ${result.path}\n`);
  }

  if (issues.some((i) => i.kind === "missing_public")) {
    ensurePublicDir(reportPath);
    applied.push(dirname(reportPath));
    process.stderr.write(`dslinter: created ${dirname(reportPath)}/\n`);
  }

  return { applied, skipped: false };
}

/**
 * Convenience: assess using default report path for a scan root.
 * @param {string} scanPath
 * @param {{ yes?: boolean }} [opts]
 */
export async function ensureMinimalSetupForScan(scanPath, opts = {}) {
  const scanAbs = resolve(scanPath);
  const reportPath = defaultReportPath(scanAbs, null);
  const targetDir = resolveProjectRoot(scanAbs);
  return ensureMinimalSetup({
    targetDir,
    reportPath,
    yes: opts.yes,
  });
}
