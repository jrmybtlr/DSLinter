import { catalogSummary, componentSpec, findingsForPaths } from "./agent-query";
import { findColorTokenForHex } from "./css-color";
import { ruleById } from "./rule-catalog";
import type { LintFinding, WorkspaceReport } from "../types/report";

export type FixSuggestion = {
  rule_id: string;
  fix_hint: string;
  suggestion: string;
  replacement_component?: string;
  replacement_import?: string;
  token?: string;
};

export function suggestFix(
  report: WorkspaceReport,
  opts: { rule_id: string; path?: string; component?: string; message?: string },
): FixSuggestion | null {
  const entry = ruleById(opts.rule_id);
  const fix_hint = entry?.fix_hint ?? "Review the finding and align with design system conventions.";

  if (opts.rule_id === "deprecated-component" && opts.component) {
    const snap = report.config_snapshot?.deprecated_components ?? [];
    const catalog = catalogSummary(report, { limit: 20 });
    const replacement = catalog.find(
      (c) =>
        !c.deprecated &&
        !snap.includes(c.name) &&
        c.name.toLowerCase().includes(
          opts.component!.replace(/^Legacy|Deprecated/i, "").toLowerCase(),
        ),
    ) ?? catalog.find((c) => !c.deprecated && c.reference_count > 0);

    return {
      rule_id: opts.rule_id,
      fix_hint,
      suggestion: replacement
        ? `Replace \`${opts.component}\` with \`${replacement.name}\` from ${replacement.import_path ?? "the catalog"}.`
        : `Remove usage of deprecated \`${opts.component}\`; pick a catalog component with similar usage.`,
      replacement_component: replacement?.name,
      replacement_import: replacement?.import_path ?? undefined,
    };
  }

  if (opts.rule_id === "token-hardcoded-color") {
    const hexMatch = opts.message?.match(/`(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))`/);
    const hex = hexMatch?.[1]?.toLowerCase();
    const colorToken =
      hex != null
        ? findColorTokenForHex(report.css_tokens?.definitions, hex)
        : report.css_tokens?.definitions.find((d) => d.category === "color");
    return {
      rule_id: opts.rule_id,
      fix_hint,
      suggestion: colorToken
        ? `Use theme token \`${colorToken.name}\` or Tailwind utility bound to it instead of hardcoded \`${hex ?? "color"}\`.`
        : "Replace hardcoded color with a CSS variable or Tailwind theme utility from css_tokens.",
      token: colorToken?.name,
    };
  }

  if (opts.rule_id === "token-tailwind-arbitrary") {
    const utilityMatch = opts.message?.match(/Use `([^`]+)` instead of arbitrary/);
    if (utilityMatch?.[1]) {
      return {
        rule_id: opts.rule_id,
        fix_hint,
        suggestion: `Replace the arbitrary value with \`${utilityMatch[1]}\` from the Tailwind or @theme spacing scale.`,
      };
    }
    return {
      rule_id: opts.rule_id,
      fix_hint,
      suggestion:
        "Replace the arbitrary bracket value with a named theme utility or CSS custom property.",
    };
  }

  if (opts.rule_id === "a11y-img-alt" && opts.path) {
    const decorative =
      /avatar|icon|logo|decorative|spacer/i.test(opts.path) ||
      /AvatarImage|Icon|Logo/i.test(opts.path);
    return {
      rule_id: opts.rule_id,
      fix_hint,
      suggestion: decorative
        ? 'Add alt="" for decorative images.'
        : "Add a descriptive alt attribute summarizing the image content.",
    };
  }

  if (opts.rule_id === "duplicate-component" && opts.component) {
    const spec = componentSpec(report, opts.component);
    return {
      rule_id: opts.rule_id,
      fix_hint,
      suggestion: spec?.duplicates
        ? `Consolidate definitions at: ${spec.duplicates.join(", ")}`
        : "Keep one canonical definition and update imports.",
    };
  }

  return {
    rule_id: opts.rule_id,
    fix_hint,
    suggestion: fix_hint,
  };
}

export type DriftSummary = {
  baseline: { saved_at: string; scores: WorkspaceReport["scores"]; finding_count: number } | null;
  current: { scores: WorkspaceReport["scores"]; finding_count: number };
  score_deltas: Record<keyof WorkspaceReport["scores"], number>;
  finding_delta: number;
};

export function computeDrift(
  report: WorkspaceReport,
  baseline: {
    saved_at: string;
    scores: WorkspaceReport["scores"];
    finding_count: number;
  } | null,
): DriftSummary {
  const currentCount = report.findings?.length ?? 0;
  const score_deltas = {
    design_system_health:
      report.scores.design_system_health -
      (baseline?.scores.design_system_health ?? report.scores.design_system_health),
    ux_consistency:
      report.scores.ux_consistency -
      (baseline?.scores.ux_consistency ?? report.scores.ux_consistency),
    accessibility:
      report.scores.accessibility -
      (baseline?.scores.accessibility ?? report.scores.accessibility),
    maintainability:
      report.scores.maintainability -
      (baseline?.scores.maintainability ?? report.scores.maintainability),
  };

  return {
    baseline: baseline
      ? {
          saved_at: baseline.saved_at,
          scores: baseline.scores,
          finding_count: baseline.finding_count,
        }
      : null,
    current: { scores: report.scores, finding_count: currentCount },
    score_deltas,
    finding_delta: currentCount - (baseline?.finding_count ?? currentCount),
  };
}

export function findingsWithSuggestions(
  findings: LintFinding[],
  report: WorkspaceReport,
): Array<LintFinding & { suggestion?: FixSuggestion }> {
  return findings.map((f) => {
    const componentMatch = f.message.match(/`([A-Z][A-Za-z0-9_]*)`/);
    const suggestion = suggestFix(report, {
      rule_id: f.rule_id,
      path: f.path,
      component: componentMatch?.[1],
      message: f.message,
    });
    return suggestion ? { ...f, suggestion } : f;
  });
}

export { findingsForPaths };
