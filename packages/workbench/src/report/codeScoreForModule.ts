import type { LintFinding, WorkspaceReport } from "../types/report";
import { pathsMatch, resolveModuleSourcePath } from "./modulePathMatch";

function isCodeScoreRule(ruleId: string): boolean {
  return ruleId.startsWith("smell-");
}

function lineSortKey(line: number | null): number {
  return line == null ? Number.POSITIVE_INFINITY : line;
}

export type CodeScoreModuleSummary = {
  score: number;
  issueCount: number;
  findings: LintFinding[];
};

export function codeScoreSummaryForModule(
  report: WorkspaceReport | null | undefined,
  modulePath: string,
): CodeScoreModuleSummary {
  if (!report) {
    return { score: 100, issueCount: 0, findings: [] };
  }

  const target = resolveModuleSourcePath(report.root, modulePath);
  const rows = report.findings.filter(
    (f) => isCodeScoreRule(f.rule_id) && pathsMatch(f.path, target),
  );
  const findings = [...rows].sort((a, b) => lineSortKey(a.line) - lineSortKey(b.line));

  let penalty = 0;
  for (const f of findings) {
    if (f.severity === "error") penalty += 25;
    else if (f.severity === "warning") penalty += 10;
    else penalty += 3;
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  return { score, issueCount: findings.length, findings };
}
