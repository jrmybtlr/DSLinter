import { isConsumerThemeDefinition } from "../playground/appPreviewTheme";
import {
  resolveCssVariables,
  resolveLightTokenValues,
  variableMapForScopes,
} from "../css/resolveCssVariables";
import type { TokenCatalog } from "../types/tokenCatalog";
import type { CssTokenDefinition, WorkspaceReport } from "../types/report";

export type TokenUsageFilter = "all" | "used" | "unused";

export type ScannedTokenRow = {
  cssName: string;
  value: string;
  category: "color" | "spacing" | "radius" | "typography" | "other";
  scope: string;
  path: string;
  line: number;
  referenceCount: number;
  fileCount: number;
  isUnused: boolean;
  /** From manual catalog when names align */
  tw?: string;
  /** Display swatch / resolved color for the wall (light / sole) */
  displayValue?: string;
  /** Raw value from a `.dark` (selector) override when present */
  darkValue?: string;
  /** Resolved swatch color for the dark override */
  darkDisplayValue?: string;
  darkPath?: string;
  darkLine?: number;
  usageFiles: string[];
};

export type MergedTokenView = {
  source: "scan" | "manual" | "hybrid";
  rows: ScannedTokenRow[];
  usedCount: number;
  totalCount: number;
};

function catalogTwByCssName(catalog: TokenCatalog): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of catalog.colors) {
    const cssVar = `--color-${c.token}${c.shade === "DEFAULT" ? "" : `-${c.shade}`}`;
    map.set(cssVar, c.tw);
  }
  for (const s of catalog.spacing) {
    map.set(`--spacing-${s.token}`, s.tw);
  }
  for (const r of catalog.radius) {
    map.set(`--radius-${r.token}`, r.tw);
  }
  const typo = catalog.typography;
  if (typo) {
    for (const f of typo.families) {
      map.set(`--font-${f.key}`, f.tw);
    }
    for (const s of typo.sizes) {
      map.set(`--font-size-${s.token}`, s.tw);
    }
  }
  return map;
}

function catalogDisplayByCssName(catalog: TokenCatalog): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of catalog.colors) {
    const cssVar = `--color-${c.token}${c.shade === "DEFAULT" ? "" : `-${c.shade}`}`;
    map.set(cssVar, c.value);
  }
  for (const s of catalog.spacing) {
    map.set(`--spacing-${s.token}`, s.value);
  }
  for (const r of catalog.radius) {
    map.set(`--radius-${r.token}`, r.value);
  }
  return map;
}

function isParseableColor(value: string): boolean {
  const v = value.trim();
  return (
    /^#[0-9a-fA-F]{3,8}$/.test(v) ||
    v.startsWith("rgb(") ||
    v.startsWith("oklch(") ||
    v.startsWith("hsl(")
  );
}

function displayValueForDefinition(
  def: CssTokenDefinition,
  manualDisplay: string | undefined,
  resolved: Record<string, string>,
): string {
  if (manualDisplay != null) return manualDisplay;

  const resolvedValue = resolved[def.name];
  if (resolvedValue != null && isParseableColor(resolvedValue)) return resolvedValue;

  if (def.category === "color" && isParseableColor(def.value)) {
    return def.value;
  }

  return def.value;
}

/** Prefer `:root`, then `@theme`, for the light (or sole) definition. */
function pickLightDefinition(defs: CssTokenDefinition[]): CssTokenDefinition | undefined {
  let theme: CssTokenDefinition | undefined;
  for (const d of defs) {
    if (d.scope === "root") return d;
    if (d.scope === "theme" && !theme) theme = d;
  }
  return theme;
}

function pickDarkDefinition(defs: CssTokenDefinition[]): CssTokenDefinition | undefined {
  return defs.find((d) => d.scope === "selector");
}

/** Dark mode = light map with selector overrides on top, then resolve `var()`. */
function resolveDarkTokenValues(
  definitions: CssTokenDefinition[],
  predicate?: (def: CssTokenDefinition) => boolean,
): Record<string, string> {
  const light = variableMapForScopes(definitions, new Set(["root", "theme"]), predicate);
  const dark = variableMapForScopes(definitions, new Set(["selector"]), predicate);
  const merged = new Map(light);
  for (const [name, value] of dark) {
    merged.set(name, value);
  }
  return resolveCssVariables(merged);
}

function groupDefinitionsByName(
  definitions: CssTokenDefinition[],
): Map<string, CssTokenDefinition[]> {
  const byName = new Map<string, CssTokenDefinition[]>();
  for (const def of definitions) {
    const list = byName.get(def.name);
    if (list) list.push(def);
    else byName.set(def.name, [def]);
  }
  return byName;
}

export function buildMergedTokenView(
  report: WorkspaceReport | null | undefined,
  catalog?: TokenCatalog,
): MergedTokenView | null {
  const summary = report?.css_tokens;
  if (!summary?.definitions?.length) {
    if (!catalog) return null;
    return { source: "manual", rows: [], totalCount: 0, usedCount: 0 };
  }

  const unusedSet = new Set(summary.unused_tokens ?? []);
  const usageByName = new Map((summary.usage_by_token ?? []).map((u) => [u.name, u]));
  const twMap = catalog ? catalogTwByCssName(catalog) : new Map<string, string>();
  const displayMap = catalog ? catalogDisplayByCssName(catalog) : new Map<string, string>();

  const consumerPredicate = report?.root
    ? (def: CssTokenDefinition) => isConsumerThemeDefinition(def, report.root)
    : undefined;
  const resolvedLight = resolveLightTokenValues(summary.definitions, consumerPredicate);
  const hasConsumerLight = Object.keys(resolvedLight).some(
    (name) => !name.startsWith("--color-") && !name.startsWith("--spacing-"),
  );
  const resolvedLightForDisplay = hasConsumerLight
    ? resolvedLight
    : resolveLightTokenValues(summary.definitions);

  const resolvedDarkForDisplay = hasConsumerLight
    ? resolveDarkTokenValues(summary.definitions, consumerPredicate)
    : resolveDarkTokenValues(summary.definitions);

  const rows: ScannedTokenRow[] = [];

  for (const [, defs] of groupDefinitionsByName(summary.definitions)) {
    const lightDef = pickLightDefinition(defs);
    const darkDef = pickDarkDefinition(defs);
    const primary = lightDef ?? darkDef;
    if (!primary) continue;

    const usage = usageByName.get(primary.name);
    const referenceCount = usage?.reference_count ?? 0;
    const isUnused = unusedSet.has(primary.name);
    const manualDisplay = displayMap.get(primary.name);

    const displayValue = lightDef
      ? displayValueForDefinition(lightDef, manualDisplay, resolvedLightForDisplay)
      : displayValueForDefinition(primary, manualDisplay, resolvedDarkForDisplay);

    const row: ScannedTokenRow = {
      cssName: primary.name,
      value: primary.value,
      category: primary.category,
      scope: primary.scope,
      path: primary.path,
      line: primary.line,
      referenceCount,
      fileCount: usage?.file_count ?? 0,
      isUnused,
      tw: twMap.get(primary.name),
      displayValue,
      usageFiles: usage?.files ?? [],
    };

    if (darkDef && lightDef) {
      row.darkValue = darkDef.value;
      row.darkDisplayValue = displayValueForDefinition(
        darkDef,
        undefined,
        resolvedDarkForDisplay,
      );
      row.darkPath = darkDef.path;
      row.darkLine = darkDef.line;
    }

    rows.push(row);
  }

  rows.sort((a, b) => a.cssName.localeCompare(b.cssName));

  const themeRoot = rows.filter((r) => r.scope === "theme" || r.scope === "root");
  const usedCount = themeRoot.filter((r) => !r.isUnused).length;

  return {
    source: catalog ? "hybrid" : "scan",
    rows,
    usedCount,
    totalCount: themeRoot.length,
  };
}

/** Stable React key — cssName alone is not unique across path when unpaired. */
export function scannedTokenRowKey(row: ScannedTokenRow): string {
  return `${row.cssName}|${row.scope}|${row.path}|${row.line}`;
}

export function filterTokenRows(
  rows: ScannedTokenRow[],
  filter: TokenUsageFilter,
): ScannedTokenRow[] {
  if (filter === "all") return rows;
  if (filter === "used") return rows.filter((r) => !r.isUnused);
  return rows.filter((r) => r.isUnused);
}

/** Case-insensitive match on token name, values, or Tailwind class. */
export function searchTokenRows(rows: ScannedTokenRow[], query: string): ScannedTokenRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    if (row.cssName.toLowerCase().includes(q)) return true;
    if (row.value.toLowerCase().includes(q)) return true;
    if (row.darkValue?.toLowerCase().includes(q)) return true;
    if (row.tw?.toLowerCase().includes(q)) return true;
    return false;
  });
}
