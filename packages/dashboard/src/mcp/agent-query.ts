import {
  aggregateDeclaredProps,
  aggregateDefinitions,
  catalogComponentNames,
  usageMap,
} from "../dashboard/aggregate";
import { findingsForComponent } from "../report/findingsForComponent";
import { controlsForSpec } from "../playground/controls";
import { genericUsageSnippet } from "../playground/snippet";
import { pillarForRule, ruleById, ruleCatalog } from "./rule-catalog";
import { findingMatchesPath } from "./normalize-paths";
import type {
  ConfigSnapshot,
  CssTokenCategory,
  CssTokenSummary,
  LintFinding,
  PlaygroundSpec,
  Severity,
  UsageLocation,
  UsageSummary,
  WorkspaceReport,
} from "../types/report";

export type CatalogEntry = {
  name: string;
  reference_count: number;
  import_path: string | null;
  deprecated: boolean;
  duplicate: boolean;
  definition_paths: string[];
};

export type ComponentSpec = {
  name: string;
  import_path: string | null;
  declared_props: string[];
  declared_prop_options?: Record<string, string[]>;
  declared_prop_defaults?: Record<string, string>;
  declared_prop_kinds?: Record<string, string>;
  usage: UsageSummary | null;
  findings: LintFinding[];
  example_jsx: string | null;
  deprecated: boolean;
  duplicates: string[] | null;
  definition_paths: string[];
};

export type FindingsQuery = {
  component?: string;
  rule_prefix?: string;
  severity?: Severity;
  path?: string;
  limit?: number;
};

export type GovernanceSummary = {
  scores: WorkspaceReport["scores"];
  finding_counts: Record<string, number>;
  total_findings: number;
};

function configSnapshot(report: WorkspaceReport): ConfigSnapshot {
  return report.config_snapshot ?? {};
}

function deprecatedSet(report: WorkspaceReport): Set<string> {
  return new Set(configSnapshot(report).deprecated_components ?? []);
}

function playgroundForComponent(
  report: WorkspaceReport,
  name: string,
): PlaygroundSpec | undefined {
  return (report.playgrounds ?? []).find(
    (p) => p.export_name === name || p.id === name,
  );
}

function importPathForComponent(
  report: WorkspaceReport,
  name: string,
): string | null {
  const pg = playgroundForComponent(report, name);
  return pg?.rel_path ?? null;
}

function duplicateLocations(
  report: WorkspaceReport,
  name: string,
): string[] | null {
  const dup = (report.duplicate_components ?? []).find((d) => d.name === name);
  return dup ? dup.locations : null;
}

function valuesFromUsageLocation(loc: UsageLocation): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if (loc.prop_values) {
    for (const [k, v] of Object.entries(loc.prop_values)) {
      if (k === "children") {
        values[k] = v;
      } else if (v === "true") {
        values[k] = true;
      } else if (v === "false") {
        values[k] = false;
      } else if (/^-?\d+(\.\d+)?$/.test(v)) {
        values[k] = Number(v);
      } else {
        values[k] = v;
      }
    }
  }
  for (const prop of loc.props) {
    if (!(prop in values) && prop !== "children") {
      values[prop] = true;
    }
  }
  return values;
}

function exampleJsxForComponent(
  report: WorkspaceReport,
  name: string,
): string | null {
  const usage = usageMap(report).get(name);
  const pg = playgroundForComponent(report, name);
  const declared = aggregateDeclaredProps(report).get(name) ?? pg?.declared_props ?? [];
  const controls = controlsForSpec(
    name,
    declared,
    pg?.declared_prop_kinds,
    pg?.declared_prop_options,
    pg?.declared_prop_defaults,
    {},
    pg?.export_name ?? name,
  );

  const loc = usage?.usage_locations?.[0];
  if (loc) {
    return genericUsageSnippet(name, valuesFromUsageLocation(loc), controls);
  }

  if (controls.length > 0) {
    const defaults: Record<string, unknown> = {};
    for (const c of controls) {
      defaults[c.key] = c.default;
    }
    return genericUsageSnippet(name, defaults, controls);
  }

  return `<${name} />`;
}

export function catalogSummary(
  report: WorkspaceReport,
  opts: { query?: string; limit?: number } = {},
): CatalogEntry[] {
  const defs = aggregateDefinitions(report);
  const usages = usageMap(report);
  const deprecated = deprecatedSet(report);
  const names = catalogComponentNames(defs, usages, report);
  const q = opts.query?.trim().toLowerCase();

  let entries: CatalogEntry[] = names.map((name) => {
    const usage = usages.get(name);
    return {
      name,
      reference_count: usage?.reference_count ?? 0,
      import_path: importPathForComponent(report, name),
      deprecated: deprecated.has(name),
      duplicate: duplicateLocations(report, name) !== null,
      definition_paths: (defs.get(name) ?? []).map((s) => s.path),
    };
  });

  if (q) {
    entries = entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.import_path?.toLowerCase().includes(q) ?? false),
    );
  }

  entries.sort(
    (a, b) =>
      b.reference_count - a.reference_count || a.name.localeCompare(b.name),
  );

  const limit = opts.limit ?? 100;
  return entries.slice(0, limit);
}

export function componentSpec(
  report: WorkspaceReport,
  name: string,
): ComponentSpec | null {
  const defs = aggregateDefinitions(report);
  if (!defs.has(name) && !usageMap(report).has(name)) {
    return null;
  }

  const pg = playgroundForComponent(report, name);
  const declared = aggregateDeclaredProps(report).get(name) ?? pg?.declared_props ?? [];

  return {
    name,
    import_path: importPathForComponent(report, name),
    declared_props: declared,
    declared_prop_options: pg?.declared_prop_options,
    declared_prop_defaults: pg?.declared_prop_defaults,
    declared_prop_kinds: pg?.declared_prop_kinds as Record<string, string> | undefined,
    usage: usageMap(report).get(name) ?? null,
    findings: findingsForComponent(report, name),
    example_jsx: exampleJsxForComponent(report, name),
    deprecated: deprecatedSet(report).has(name),
    duplicates: duplicateLocations(report, name),
    definition_paths: (defs.get(name) ?? []).map((s) => s.path),
  };
}

export function findingsQuery(
  report: WorkspaceReport,
  filters: FindingsQuery,
): LintFinding[] {
  let rows = [...(report.findings ?? [])];

  if (filters.component) {
    const componentFindings = findingsForComponent(report, filters.component);
    const ids = new Set(
      componentFindings.map(
        (f) => `${f.rule_id}:${f.path}:${f.line ?? "x"}`,
      ),
    );
    rows = rows.filter((f) =>
      ids.has(`${f.rule_id}:${f.path}:${f.line ?? "x"}`),
    );
  }

  if (filters.rule_prefix) {
    const prefix = filters.rule_prefix;
    rows = rows.filter((f) => f.rule_id.startsWith(prefix));
  }

  if (filters.severity) {
    rows = rows.filter((f) => f.severity === filters.severity);
  }

  if (filters.path) {
    rows = rows.filter((f) => findingMatchesPath(f, filters.path!));
  }

  const severityOrder: Record<Severity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  rows.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      a.path.localeCompare(b.path) ||
      (a.line ?? 0) - (b.line ?? 0),
  );

  const limit = filters.limit ?? 50;
  return rows.slice(0, limit);
}

export function findingsForPaths(
  report: WorkspaceReport,
  paths: string[],
): LintFinding[] {
  const normalized = paths.map((p) => p.replace(/\\/g, "/"));
  return (report.findings ?? [])
    .filter((f) => normalized.some((p) => findingMatchesPath(f, p)))
    .sort(
      (a, b) =>
        a.path.localeCompare(b.path) ||
        (a.line ?? 0) - (b.line ?? 0) ||
        a.rule_id.localeCompare(b.rule_id),
    );
}

export type TokenSummaryEntry = {
  name: string;
  category: CssTokenCategory;
  value: string;
  reference_count: number;
  unused: boolean;
};

export function tokenSummary(
  report: WorkspaceReport,
  category?: CssTokenCategory,
): { tokens: TokenSummaryEntry[]; unused_count: number } {
  const css: CssTokenSummary | undefined = report.css_tokens;
  if (!css) return { tokens: [], unused_count: 0 };

  const unusedSet = new Set(css.unused_tokens ?? []);
  const usageByName = new Map(
    (css.usage_by_token ?? []).map((u) => [u.name, u.reference_count]),
  );

  let tokens: TokenSummaryEntry[] = css.definitions.map((d) => ({
    name: d.name,
    category: d.category,
    value: d.value,
    reference_count: usageByName.get(d.name) ?? 0,
    unused: unusedSet.has(d.name),
  }));

  if (category) {
    tokens = tokens.filter((t) => t.category === category);
  }

  tokens.sort((a, b) => a.name.localeCompare(b.name));

  return {
    tokens,
    unused_count: (css.unused_tokens ?? []).length,
  };
}

export function governanceSummary(report: WorkspaceReport): GovernanceSummary {
  const finding_counts: Record<string, number> = {
    a11y: 0,
    token: 0,
    usage: 0,
    code: 0,
  };

  for (const f of report.findings ?? []) {
    const pillar = pillarForRule(f.rule_id);
    finding_counts[pillar] = (finding_counts[pillar] ?? 0) + 1;
  }

  return {
    scores: report.scores,
    finding_counts,
    total_findings: report.findings?.length ?? 0,
  };
}

export function usageExamples(
  report: WorkspaceReport,
  component: string,
  limit = 10,
): {
  component: string;
  prop_frequencies: Record<string, number>;
  prop_value_frequencies: Record<string, Record<string, number>>;
  examples: UsageLocation[];
} | null {
  const usage = usageMap(report).get(component);
  if (!usage) return null;

  return {
    component,
    prop_frequencies: usage.prop_frequencies ?? {},
    prop_value_frequencies: usage.prop_value_frequencies ?? {},
    examples: (usage.usage_locations ?? []).slice(0, limit),
  };
}

export function policyFromReport(report: WorkspaceReport) {
  const snap = configSnapshot(report);
  return {
    deprecated_components: snap.deprecated_components ?? [],
    known_tokens: snap.known_tokens ?? [],
    include_dirs: snap.include_dirs ?? [],
    rules: ruleCatalog(),
    schema_version: report.schema_version ?? 0,
    generated_at: report.generated_at ?? null,
  };
}
