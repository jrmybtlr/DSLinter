import type { LintFinding, WorkspaceReport } from "../types/report";
import { a11yScoreFromFindings } from "./a11yScoring";
import { pathsMatch, resolveModuleSourcePath } from "./modulePathMatch";

export type A11yModuleSummary = {
  /** 0–100 heuristic from DSLinter `a11y-*` findings on this source file. */
  score: number;
  /** Count of `a11y-*` findings on this file. */
  issueCount: number;
  findings: LintFinding[];
};

export { resolveModuleSourcePath } from "./modulePathMatch";

export function a11ySummaryForModule(
  report: WorkspaceReport | null | undefined,
  modulePath: string,
): A11yModuleSummary {
  if (!report) {
    return { score: 100, issueCount: 0, findings: [] };
  }

  const target = resolveModuleSourcePath(report.root, modulePath);
  const all = report.findings.filter((f) => f.rule_id.startsWith("a11y-"));
  const findings = all.filter((f) => pathsMatch(f.path, target));

  const score = a11yScoreFromFindings(findings);

  return { score, issueCount: findings.length, findings };
}
