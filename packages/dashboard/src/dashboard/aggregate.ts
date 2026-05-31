import type { ComponentDefinition, FileScan, UsageSummary, WorkspaceReport } from "../types/report";
import {
  definitionPathsForName,
  isCatalogComponentHidden,
} from "./catalogVisibility";

export interface DefinitionSite {
  kind: ComponentDefinition["kind"];
  path: string;
  line: number;
}

export type CatalogFamily = {
  parent: string;
  children: string[];
  path: string;
};

export type CatalogTreeItem = { type: "component"; name: string } | CatalogTreeFamily;

export type CatalogTreeFamily = {
  type: "family";
  parent: string;
  children: string[];
  path: string;
};

const PLAYABLE_KINDS = new Set<ComponentDefinition["kind"]>([
  "function",
  "class",
  "const_arrow",
  "const_function",
  "wrapped_component",
]);

function isPlayableDefinition(def: ComponentDefinition): boolean {
  return PLAYABLE_KINDS.has(def.kind);
}

function fileStem(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.(tsx|jsx)$/i, "");
}

function normalizedName(value: string): string {
  return value
    .replace(/\.playground$/i, "")
    .split("")
    .filter((c) => c !== "-" && c !== "_")
    .join("")
    .toLowerCase();
}

export function aggregateDefinitions(report: WorkspaceReport): Map<string, DefinitionSite[]> {
  const map = new Map<string, DefinitionSite[]>();
  for (const file of report.files ?? []) {
    for (const d of file.definitions ?? []) {
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

/** Merges `declared_props` from scan definitions and playground rows (source order, then deduped). */
export function aggregateDeclaredProps(report: WorkspaceReport): Map<string, string[]> {
  const map = new Map<string, string[]>();

  const add = (name: string, props: readonly string[] | undefined) => {
    if (!props?.length) return;
    let list = map.get(name);
    if (!list) {
      list = [];
      map.set(name, list);
    }
    for (const p of props) {
      if (!list.includes(p)) list.push(p);
    }
  };

  for (const file of report.files ?? []) {
    for (const d of file.definitions ?? []) {
      add(d.name, d.declared_props);
    }
  }
  for (const pg of report.playgrounds ?? []) {
    add(pg.export_name, pg.declared_props);
  }

  return map;
}

export function usageMap(report: WorkspaceReport): Map<string, UsageSummary> {
  const m = new Map<string, UsageSummary>();
  for (const row of report.usage_by_component ?? []) {
    m.set(row.component, row);
  }
  return m;
}

function isVisibleCatalogName(report: WorkspaceReport, name: string): boolean {
  return !isCatalogComponentHidden(
    name,
    report,
    definitionPathsForName(report, name),
  );
}

export function catalogComponentNames(
  defs: Map<string, DefinitionSite[]>,
  usages: Map<string, UsageSummary>,
  report: WorkspaceReport,
): string[] {
  const names = new Set<string>();
  for (const k of defs.keys()) {
    if (isVisibleCatalogName(report, k)) names.add(k);
  }
  for (const k of usages.keys()) {
    if (isVisibleCatalogName(report, k)) names.add(k);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Unique component names for sidebar / command palette (definitions ∪ usage). */
export function componentCatalogNamesFromReport(
  report: WorkspaceReport | null | undefined,
): string[] {
  if (!report) return [];
  return catalogComponentNames(aggregateDefinitions(report), usageMap(report), report);
}

function familyFromFile(file: FileScan, report: WorkspaceReport): CatalogFamily | null {
  const defs = (file.definitions ?? []).filter((d) => {
    if (!isPlayableDefinition(d)) return false;
    return !isCatalogComponentHidden(d.name, report, [file.path]);
  });
  if (defs.length < 2) return null;

  const stem = normalizedName(fileStem(file.path));
  const root = defs.find((d) => normalizedName(d.name) === stem);
  if (!root) return null;

  const children = defs
    .map((d) => d.name)
    .filter((name) => name !== root.name && name.startsWith(root.name))
    .sort((a, b) => a.localeCompare(b));
  if (children.length === 0) return null;

  return { parent: root.name, children, path: file.path };
}

export function componentCatalogFamiliesFromReport(
  report: WorkspaceReport | null | undefined,
): CatalogFamily[] {
  if (!report) return [];
  const byParent = new Map<string, CatalogFamily>();
  for (const file of report.files ?? []) {
    const family = familyFromFile(file, report);
    if (!family) continue;
    if (!isVisibleCatalogName(report, family.parent)) continue;
    const existing = byParent.get(family.parent);
    if (!existing) {
      byParent.set(family.parent, family);
      continue;
    }
    const children = new Set([...existing.children, ...family.children]);
    byParent.set(family.parent, {
      ...existing,
      children: [...children].sort((a, b) => a.localeCompare(b)),
    });
  }
  return [...byParent.values()].sort((a, b) => a.parent.localeCompare(b.parent));
}

export function componentCatalogTreeFromReport(
  report: WorkspaceReport | null | undefined,
): CatalogTreeItem[] {
  const names = componentCatalogNamesFromReport(report);
  const families = componentCatalogFamiliesFromReport(report);
  const familyByParent = new Map(families.map((f) => [f.parent, f]));
  const childNames = new Set(families.flatMap((f) => f.children));
  const items: CatalogTreeItem[] = [];

  for (const name of names) {
    const family = familyByParent.get(name);
    if (family) {
      items.push({ type: "family", ...family });
      continue;
    }
    if (childNames.has(name)) continue;
    items.push({ type: "component", name });
  }

  return items;
}

export function componentCatalogFamilyForName(
  report: WorkspaceReport | null | undefined,
  name: string,
): CatalogFamily | undefined {
  return componentCatalogFamiliesFromReport(report).find(
    (family) => family.parent === name || family.children.includes(name),
  );
}
