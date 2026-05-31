import { catalogSummary, governanceSummary, tokenSummary } from "./agent-query";
import { ruleCatalog } from "./rule-catalog";
import type { WorkspaceReport } from "../types/report";

export type AgentContextOptions = {
  max_components?: number;
  max_findings?: number;
  format?: "markdown" | "json";
};

function topUsageHint(
  propValueFreqs: Record<string, Record<string, number>> | undefined,
): string {
  if (!propValueFreqs) return "";
  const parts: string[] = [];
  for (const [prop, values] of Object.entries(propValueFreqs)) {
    const sorted = Object.entries(values).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    if (top) parts.push(`${prop}=${top[0]}`);
  }
  return parts.slice(0, 3).join(", ");
}

export function buildAgentContext(
  report: WorkspaceReport,
  opts: AgentContextOptions = {},
): string | Record<string, unknown> {
  const maxComponents = opts.max_components ?? 30;
  const maxFindings = opts.max_findings ?? 10;
  const format = opts.format ?? "markdown";

  const gov = governanceSummary(report);
  const catalog = catalogSummary(report, { limit: maxComponents });
  const tokens = tokenSummary(report);
  const snap = report.config_snapshot ?? {};

  const deprecated = catalog.filter((c) => c.deprecated).map((c) => c.name);
  const duplicates = catalog.filter((c) => c.duplicate).map((c) => c.name);

  const topFindings = [...(report.findings ?? [])]
    .sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, maxFindings)
    .map((f) => ({
      rule_id: f.rule_id,
      severity: f.severity,
      path: f.path,
      line: f.line,
      message: f.message,
    }));

  const payload = {
    schema_version: report.schema_version ?? 1,
    generated_at: report.generated_at ?? null,
    scores: gov.scores,
    finding_counts: gov.finding_counts,
    top_components: catalog.map((c) => ({
      name: c.name,
      references: c.reference_count,
      import_path: c.import_path,
      usage_hint: topUsageHint(
        report.usage_by_component.find((u) => u.component === c.name)
          ?.prop_value_frequencies,
      ),
    })),
    deprecated_components: deprecated,
    duplicate_components: duplicates,
    top_findings: topFindings,
    token_summary: {
      defined: tokens.tokens.length,
      unused: tokens.unused_count,
    },
    policy: {
      include_dirs: snap.include_dirs ?? [],
      known_tokens: snap.known_tokens ?? [],
    },
    dos: [
      "Use components from the catalog before creating new ones.",
      "Match prop values to repo usage patterns (see top_components.usage_hint).",
      "Use theme tokens and Tailwind utilities from known_tokens / css_tokens.",
    ],
    donts: [
      ...(deprecated.length
        ? [`Do not use deprecated components: ${deprecated.join(", ")}.`]
        : []),
      "Do not hardcode hex colors or Tailwind arbitrary values.",
      "Do not duplicate existing component names.",
      ...(snap.include_dirs?.length
        ? [`Prefer components under: ${snap.include_dirs.join(", ")}.`]
        : []),
    ],
  };

  if (format === "json") {
    return payload;
  }

  const lines: string[] = [
    "# DSLinter agent context",
    "",
    `Generated: ${payload.generated_at ?? "unknown"}`,
    "",
    "## Governance scores",
    `- Design system health: ${gov.scores.design_system_health}/100`,
    `- UX consistency: ${gov.scores.ux_consistency}/100`,
    `- Accessibility: ${gov.scores.accessibility}/100`,
    `- Maintainability: ${gov.scores.maintainability}/100`,
    "",
    "## Top components (by usage)",
  ];

  for (const c of payload.top_components) {
    const hint = c.usage_hint ? ` — ${c.usage_hint}` : "";
    const path = c.import_path ? ` (${c.import_path})` : "";
    lines.push(`- **${c.name}** (${c.references} refs)${path}${hint}`);
  }

  if (deprecated.length) {
    lines.push("", "## Deprecated (do not use)", deprecated.map((d) => `- ${d}`).join("\n"));
  }
  if (duplicates.length) {
    lines.push("", "## Duplicates (consolidate)", duplicates.map((d) => `- ${d}`).join("\n"));
  }

  if (topFindings.length) {
    lines.push("", "## Top findings");
    for (const f of topFindings) {
      lines.push(
        `- [${f.severity}] ${f.rule_id} @ ${f.path}${f.line != null ? `:${f.line}` : ""}: ${f.message}`,
      );
    }
  }

  lines.push(
    "",
    "## Do",
    ...payload.dos.map((d) => `- ${d}`),
    "",
    "## Don't",
    ...payload.donts.map((d) => `- ${d}`),
  );

  lines.push("", "## Rule catalog", `${ruleCatalog().length} rules documented.`);

  return lines.join("\n");
}
