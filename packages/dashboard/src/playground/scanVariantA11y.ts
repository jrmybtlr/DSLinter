import type { PlaygroundArgs } from "../types/controls";
import type { LintFinding, Severity } from "../types/report";
import { a11yScoreFromFindings } from "../report/a11yScoring";

export type PlaygroundA11yFinding = LintFinding & {
  /** Prop combo label when the finding comes from the variant matrix scan. */
  variantLabel?: string;
};

export type VariantPreviewTarget = {
  element: Element;
  combo: PlaygroundArgs;
  axisKeys: string[];
};

const SCAN_CONCURRENCY = 4;

function formatAxisValue(value: string | number | boolean | undefined): string {
  if (value === undefined) return "?";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function formatVariantLabel(
  combo: PlaygroundArgs,
  axisKeys: string[],
): string {
  return axisKeys
    .map((key) => `${key}=${formatAxisValue(combo[key])}`)
    .join(" ");
}

function axeImpactToSeverity(
  impact: string | null | undefined,
): Severity {
  if (impact === "critical" || impact === "serious") return "error";
  if (impact === "moderate") return "warning";
  return "info";
}

async function loadAxe() {
  const mod = await import("axe-core");
  return mod.default;
}

export async function scanElementA11y(
  element: Element,
  variantLabel: string,
): Promise<PlaygroundA11yFinding[]> {
  const axe = await loadAxe();
  const results = await axe.run(element, {
    runOnly: {
      type: "rule",
      values: ["color-contrast"],
    },
  });

  const findings: PlaygroundA11yFinding[] = [];
  for (const violation of results.violations) {
    const severity = axeImpactToSeverity(violation.impact);
    const summary = violation.help || violation.description;
    for (const node of violation.nodes) {
      findings.push({
        rule_id: `a11y-playground-${violation.id}`,
        message: node.failureSummary
          ? `${summary} (${node.failureSummary})`
          : summary,
        path: "",
        line: null,
        severity,
        variantLabel,
      });
    }
  }
  return findings;
}

export async function scanVariantPreviews(
  targets: VariantPreviewTarget[],
): Promise<PlaygroundA11yFinding[]> {
  const findings: PlaygroundA11yFinding[] = [];

  for (let i = 0; i < targets.length; i += SCAN_CONCURRENCY) {
    const chunk = targets.slice(i, i + SCAN_CONCURRENCY);
    const chunkFindings = await Promise.all(
      chunk.map(({ element, combo, axisKeys }) =>
        scanElementA11y(element, formatVariantLabel(combo, axisKeys)),
      ),
    );
    findings.push(...chunkFindings.flat());
  }

  return findings;
}

export function mergePlaygroundA11yFindings(
  staticFindings: LintFinding[],
  variantFindings: PlaygroundA11yFinding[],
): PlaygroundA11yFinding[] {
  return [...staticFindings, ...variantFindings];
}

export function playgroundA11yScore(
  staticFindings: LintFinding[],
  variantFindings: PlaygroundA11yFinding[],
): number {
  return a11yScoreFromFindings(
    mergePlaygroundA11yFindings(staticFindings, variantFindings),
  );
}
