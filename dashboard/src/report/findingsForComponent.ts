import { aggregateDefinitions } from "../dashboard/aggregate";
import type { LintFinding, WorkspaceReport } from "../types/report";
import { pathsMatch } from "./modulePathMatch";

/** Findings on any file where the component is defined. */
export function findingsForComponent(
  report: WorkspaceReport | null | undefined,
  componentName: string,
): LintFinding[] {
  if (!report) return [];
  const defs = aggregateDefinitions(report);
  const sites = defs.get(componentName) ?? [];
  if (sites.length === 0) return [];

  const rows = report.findings.filter((f) =>
    sites.some((site) => pathsMatch(f.path, site.path)),
  );
  return [...rows].sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.rule_id.localeCompare(b.rule_id),
  );
}
