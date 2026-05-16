import type { LintFinding, WorkspaceReport } from "../types/report";
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

  let penalty = 0;
  for (const f of findings) {
    if (f.severity === "error") penalty += 25;
    else if (f.severity === "warning") penalty += 10;
    else penalty += 3;
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  return { score, issueCount: findings.length, findings };
}
