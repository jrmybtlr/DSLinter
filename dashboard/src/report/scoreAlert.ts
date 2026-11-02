import type { LintFinding, Severity, WorkspaceReport } from "../types/report";
import { a11yScoreFromFindings } from "./a11yScoring";
import { pathsMatch } from "./modulePathMatch";

/** Gray under 100, warning under 90, red under 70. */
export type ScoreAlertLevel = "muted" | "warning" | "critical";

const RANK: Record<ScoreAlertLevel, number> = { muted: 1, warning: 2, critical: 3 };

export function scoreAlertLevel(score: number): ScoreAlertLevel | null {
  if (!Number.isFinite(score) || score >= 100) return null;
  if (score < 70) return "critical";
  if (score < 90) return "warning";
  return "muted";
}

export function worstScoreAlert(
  levels: ReadonlyArray<ScoreAlertLevel | null | undefined>,
): ScoreAlertLevel | null {
  let worst: ScoreAlertLevel | null = null;
  for (const level of levels) {
    if (!level) continue;
    if (!worst || RANK[level] > RANK[worst]) worst = level;
  }
  return worst;
}

function isCodeScoreRule(ruleId: string): boolean {
  return ruleId.startsWith("smell-") || ruleId.startsWith("code-");
}

function relativeToRoot(root: string, path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const base = root.replace(/\\/g, "/").replace(/\/$/, "");
  if (normalized === base) return "";
  if (base && normalized.startsWith(`${base}/`)) return normalized.slice(base.length + 1);
  return normalized.replace(/^\.\//, "");
}

function sameFile(root: string, filePath: string, findingPath: string): boolean {
  if (pathsMatch(filePath, findingPath)) return true;
  const file = relativeToRoot(root, filePath);
  const finding = relativeToRoot(root, findingPath);
  return file === finding || pathsMatch(file, finding);
}

function scoreFrom(findings: ReadonlyArray<{ severity: Severity }>): number {
  return a11yScoreFromFindings(findings);
}

/** Worst code/accessibility alert for each component name in the report. */
export function scoreAlertsByComponent(
  report: WorkspaceReport | null | undefined,
): Map<string, ScoreAlertLevel> {
  const alerts = new Map<string, ScoreAlertLevel>();
  if (!report) return alerts;

  const findings = report.findings ?? [];
  for (const file of report.files ?? []) {
    const onFile = (predicate: (finding: LintFinding) => boolean) =>
      findings.filter(
        (finding) => predicate(finding) && sameFile(report.root, file.path, finding.path),
      );
    const level = worstScoreAlert([
      scoreAlertLevel(scoreFrom(onFile((finding) => isCodeScoreRule(finding.rule_id)))),
      scoreAlertLevel(scoreFrom(onFile((finding) => finding.rule_id.startsWith("a11y-")))),
    ]);
    if (!level) continue;
    for (const definition of file.definitions ?? []) {
      alerts.set(definition.name, worstScoreAlert([alerts.get(definition.name), level])!);
    }
  }
  return alerts;
}
