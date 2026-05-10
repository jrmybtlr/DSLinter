import type { LintFinding, WorkspaceReport } from "../types/report";

export type A11yModuleSummary = {
  /** 0–100 heuristic from DSLint `a11y-*` findings on this source file. */
  score: number;
  /** Count of `a11y-*` findings on this file. */
  issueCount: number;
  findings: LintFinding[];
};

function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Resolve `../components/...` (from demo `src/playground`) to path under `report.root`. */
export function resolveModuleSourcePath(reportRoot: string, modulePath: string): string {
  const rel = norm(modulePath.replace(/^\.\.\//, ""));
  const withSrc = rel.startsWith("components/") ? `src/${rel}` : rel;
  const root = norm(reportRoot).replace(/\/$/, "");
  return `${root}/${withSrc}`;
}

/** Match finding path to source file even when `report.root` differs from machine that generated JSON. */
function tailSrcComponents(p: string): string | null {
  const m = norm(p).match(/(src\/components\/.+)$/);
  return m ? m[1] : null;
}

function pathsMatch(reportPath: string, candidate: string): boolean {
  const a = norm(reportPath);
  const b = norm(candidate);
  if (a === b) return true;
  const ta = tailSrcComponents(a);
  const tb = tailSrcComponents(b);
  if (ta && tb) return ta === tb;
  return false;
}

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
