import type { Severity } from "../types/report";

export function a11yScoreFromSeverities(severities: Severity[]): number {
  let penalty = 0;
  for (const severity of severities) {
    if (severity === "error") penalty += 25;
    else if (severity === "warning") penalty += 10;
    else penalty += 3;
  }
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function a11yScoreFromFindings(
  findings: ReadonlyArray<{ severity: Severity }>,
): number {
  return a11yScoreFromSeverities(findings.map((f) => f.severity));
}
