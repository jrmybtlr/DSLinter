import type { TokenCatalog } from "../types/tokenCatalog";
import type { WorkspaceReport } from "../types/report";

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
  /** Display swatch / resolved color for the wall */
  displayValue?: string;
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
  const usageByName = new Map(
    (summary.usage_by_token ?? []).map((u) => [u.name, u]),
  );
  const twMap = catalog ? catalogTwByCssName(catalog) : new Map<string, string>();
  const displayMap = catalog
    ? catalogDisplayByCssName(catalog)
    : new Map<string, string>();

  const rows: ScannedTokenRow[] = summary.definitions.map((def) => {
    const usage = usageByName.get(def.name);
    const referenceCount = usage?.reference_count ?? 0;
    const isUnused = unusedSet.has(def.name);
    const manualDisplay = displayMap.get(def.name);
    const displayValue =
      manualDisplay ??
      (def.category === "color" && isParseableColor(def.value)
        ? def.value
        : def.value.startsWith("var(")
          ? manualDisplay
          : def.value);

    return {
      cssName: def.name,
      value: def.value,
      category: def.category,
      scope: def.scope,
      path: def.path,
      line: def.line,
      referenceCount,
      fileCount: usage?.file_count ?? 0,
      isUnused,
      tw: twMap.get(def.name),
      displayValue: displayValue ?? def.value,
      usageFiles: usage?.files ?? [],
    };
  });

  rows.sort((a, b) => a.cssName.localeCompare(b.cssName));

  const themeRoot = rows.filter(
    (r) => r.scope === "theme" || r.scope === "root",
  );
  const usedCount = themeRoot.filter((r) => !r.isUnused).length;

  return {
    source: catalog ? "hybrid" : "scan",
    rows,
    usedCount,
    totalCount: themeRoot.length,
  };
}

export function filterTokenRows(
  rows: ScannedTokenRow[],
  filter: TokenUsageFilter,
): ScannedTokenRow[] {
  if (filter === "all") return rows;
  if (filter === "used") return rows.filter((r) => !r.isUnused);
  return rows.filter((r) => r.isUnused);
}
