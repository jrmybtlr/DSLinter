import type { LintFinding, WorkspaceReport } from "../types/report";
import { pathsMatch, resolveModuleSourcePath } from "./modulePathMatch";

function isTokenStyleRule(ruleId: string): boolean {
  return ruleId.startsWith("token-");
}

function lineSortKey(line: number | null): number {
  return line == null ? Number.POSITIVE_INFINITY : line;
}

/** Hardcoded / arbitrary token color findings for a playground module path. */
export function tokenStyleFindingsForModule(
  report: WorkspaceReport | null | undefined,
  modulePath: string,
): LintFinding[] {
  if (!report) return [];

  const target = resolveModuleSourcePath(report.root, modulePath);
  const rows = report.findings.filter(
    (f) => isTokenStyleRule(f.rule_id) && pathsMatch(f.path, target),
  );
  return [...rows].sort((a, b) => lineSortKey(a.line) - lineSortKey(b.line));
}
