import { pillarForRule } from "../mcp/rule-catalog";
import type {
  ComponentDefinition,
  FileScan,
  LintFinding,
  UsageSummary,
  WorkspaceReport,
} from "../types/report";
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

/** `hover-card.tsx` → `HoverCard`, `icons.tsx` → `Icons`. */
export function fileStemToCatalogGroupLabel(stem: string): string {
  return stem
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
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
  const sets = new Map<string, Set<string>>();

  const add = (name: string, props: readonly string[] | undefined) => {
    if (!props?.length) return;
    let set = sets.get(name);
    if (!set) {
      set = new Set();
      sets.set(name, set);
    }
    for (const p of props) set.add(p);
  };

  for (const file of report.files ?? []) {
    for (const d of file.definitions ?? []) {
      add(d.name, d.declared_props);
    }
  }
  for (const pg of report.playgrounds ?? []) {
    add(pg.export_name, pg.declared_props);
  }

  const map = new Map<string, string[]>();
  for (const [name, set] of sets) {
    map.set(name, [...set]);
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

export type UnusedComponent = {
  name: string;
  definitionPaths: string[];
};

/** Defined components with zero JSX references in the scanned workspace. */
export function unusedComponentsFromReport(
  report: WorkspaceReport | null | undefined,
): UnusedComponent[] {
  if (!report) return [];
  const defs = aggregateDefinitions(report);
  const usages = usageMap(report);
  const out: UnusedComponent[] = [];

  for (const [name, sites] of defs) {
    if (!isVisibleCatalogName(report, name)) continue;
    const usage = usages.get(name);
    if (usage && usage.reference_count > 0) continue;
    out.push({
      name,
      definitionPaths: sites.map((s) => s.path),
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export type GovernanceInventoryTab = "all" | "a11y" | "code" | "token" | "unused";

export function governanceTabCounts(
  report: WorkspaceReport | null | undefined,
): Record<GovernanceInventoryTab, number> {
  const counts: Record<GovernanceInventoryTab, number> = {
    all: 0,
    a11y: 0,
    code: 0,
    token: 0,
    unused: 0,
  };
  if (!report) return counts;

  for (const finding of report.findings ?? []) {
    counts.all += 1;
    const pillar = pillarForRule(finding.rule_id);
    if (pillar === "a11y") counts.a11y += 1;
    else if (pillar === "code") counts.code += 1;
    else if (pillar === "token") counts.token += 1;
  }

  counts.unused = unusedComponentsFromReport(report).length;
  return counts;
}

export function findingsForGovernanceTab(
  report: WorkspaceReport | null | undefined,
  tab: GovernanceInventoryTab,
): LintFinding[] {
  if (!report || tab === "unused") return [];
  const findings = report.findings ?? [];
  if (tab === "all") return findings;
  return findings.filter((f) => pillarForRule(f.rule_id) === tab);
}

function familyFromFile(file: FileScan, report: WorkspaceReport): CatalogFamily | null {
  const defs = (file.definitions ?? []).filter((d) => {
    if (!isPlayableDefinition(d)) return false;
    return !isCatalogComponentHidden(d.name, report, [file.path]);
  });
  if (defs.length < 2) return null;

  const children = defs.map((d) => d.name).sort((a, b) => a.localeCompare(b));
  return { parent: fileStemToCatalogGroupLabel(fileStem(file.path)), children, path: file.path };
}

/** `Select` + `Value` yes; `Selector` no. */
function isCompoundFamilyMember(parent: string, name: string): boolean {
  if (name === parent) return true;
  if (!name.startsWith(parent) || name.length <= parent.length) return false;
  const next = name.charAt(parent.length);
  return next === next.toUpperCase() && next !== next.toLowerCase();
}

function shouldAttachNameToFamily(
  name: string,
  family: CatalogFamily,
  definitionPaths: string[],
): boolean {
  if (family.children.includes(name)) return false;
  if (name === family.parent) return true;
  if (definitionPaths.length > 0) {
    return definitionPaths.every((p) => p === family.path);
  }
  return isCompoundFamilyMember(family.parent, name);
}

function enrichCatalogFamily(
  family: CatalogFamily,
  catalogNames: string[],
  report: WorkspaceReport,
): CatalogFamily {
  const children = new Set(family.children);
  for (const name of catalogNames) {
    if (
      shouldAttachNameToFamily(
        name,
        family,
        definitionPathsForName(report, name),
      )
    ) {
      children.add(name);
    }
  }
  return {
    ...family,
    children: [...children].sort((a, b) => a.localeCompare(b)),
  };
}

export function componentCatalogFamiliesFromReport(
  report: WorkspaceReport | null | undefined,
): CatalogFamily[] {
  if (!report) return [];
  const catalogNames = componentCatalogNamesFromReport(report);
  const byPath = new Map<string, CatalogFamily>();
  for (const file of report.files ?? []) {
    const family = familyFromFile(file, report);
    if (!family) continue;
    byPath.set(family.path, enrichCatalogFamily(family, catalogNames, report));
  }
  return [...byPath.values()].sort((a, b) => a.parent.localeCompare(b.parent));
}

/** Best component id when navigating to a file-stem group label. */
export function resolveFamilyNavigationTarget(
  family: CatalogFamily,
  catalogNames: string[],
): string {
  if (catalogNames.includes(family.parent)) return family.parent;
  const stem = normalizedName(fileStem(family.path));
  const stemMatch = family.children.find((c) => normalizedName(c) === stem);
  if (stemMatch) return stemMatch;
  return family.children[0] ?? family.parent;
}

function catalogTreeSortKey(item: CatalogTreeItem): string {
  return item.type === "family" ? item.parent : item.name;
}

export function componentCatalogTreeFromReport(
  report: WorkspaceReport | null | undefined,
): CatalogTreeItem[] {
  const names = componentCatalogNamesFromReport(report);
  const families = componentCatalogFamiliesFromReport(report);
  const childNames = new Set(families.flatMap((f) => f.children));
  const familyParentLabels = new Set(families.map((f) => f.parent));
  const items: CatalogTreeItem[] = [];

  for (const family of families) {
    items.push({ type: "family", ...family });
  }

  for (const name of names) {
    if (childNames.has(name)) continue;
    if (familyParentLabels.has(name)) continue;
    items.push({ type: "component", name });
  }

  return items.sort((a, b) =>
    catalogTreeSortKey(a).localeCompare(catalogTreeSortKey(b)),
  );
}

export function componentCatalogFamilyForName(
  report: WorkspaceReport | null | undefined,
  name: string,
): CatalogFamily | undefined {
  return componentCatalogFamiliesFromReport(report).find(
    (family) => family.parent === name || family.children.includes(name),
  );
}

/** Sibling/child exports to show for a compound component family. */
export function catalogChildComponentsFor(
  family: CatalogFamily | undefined,
  componentId: string,
): string[] {
  if (!family) return [];
  if (family.children.includes(componentId)) {
    return family.children.filter((child) => child !== componentId);
  }
  if (family.parent === componentId) return family.children;
  return [];
}
