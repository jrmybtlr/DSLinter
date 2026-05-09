import type { ComponentDefinition, UsageSummary, WorkspaceReport } from "./types";

export interface DefinitionSite {
  kind: ComponentDefinition["kind"];
  path: string;
  line: number;
}

const HIDDEN_COMPONENTS = new Set(["App", "React.StrictMode"]);

export function aggregateDefinitions(report: WorkspaceReport): Map<string, DefinitionSite[]> {
  const map = new Map<string, DefinitionSite[]>();
  for (const file of report.files) {
    for (const d of file.definitions) {
      if (HIDDEN_COMPONENTS.has(d.name)) continue;
      const list = map.get(d.name) ?? [];
      list.push({ kind: d.kind, path: file.path, line: d.line });
      map.set(d.name, list);
    }
  }
  for (const [, sites] of map) {
    sites.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  }
  return map;
}

export function usageMap(report: WorkspaceReport): Map<string, UsageSummary> {
  const m = new Map<string, UsageSummary>();
  for (const row of report.usage_by_component) {
    if (HIDDEN_COMPONENTS.has(row.component)) continue;
    m.set(row.component, row);
  }
  return m;
}

export function catalogComponentNames(
  defs: Map<string, DefinitionSite[]>,
  usages: Map<string, UsageSummary>,
): string[] {
  const names = new Set<string>();
  for (const k of defs.keys()) names.add(k);
  for (const k of usages.keys()) names.add(k);
  return [...names].sort((a, b) => a.localeCompare(b));
}
