import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../components/ui/hover-card";
import { Input } from "../components/ui/input";
import { IconSearch } from "../components/icons";
import { cn } from "../lib/utils";
import { EmptyCard } from "../components/EmptyCard";
import { TruncatedPath } from "../components/TruncatedPath";
import {
  filterTokenRows,
  scannedTokenRowKey,
  searchTokenRows,
  type MergedTokenView,
  type ScannedTokenRow,
  type TokenUsageFilter,
} from "./mergeTokenCatalog";

const filterTabs: { id: TokenUsageFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "used", label: "Used" },
  { id: "unused", label: "Unused" },
];

function emptyFilterMessage(filter: TokenUsageFilter, hasSearch: boolean): string {
  if (hasSearch) return "No tokens match this search.";
  if (filter === "used") return "No used theme tokens match this filter.";
  if (filter === "unused") {
    return "No unused theme tokens — every scanned token is referenced in the workspace.";
  }
  return "No theme tokens found.";
}

function TokenSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

function TokenUsageBadge({ row }: { row: ScannedTokenRow }) {
  if (row.isUnused) {
    return (
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        unused
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {row.fileCount} {row.fileCount === 1 ? "file" : "files"}
    </span>
  );
}

function TokenUsageHover({ row }: { row: ScannedTokenRow }) {
  if (row.referenceCount === 0) {
    return <TokenUsageBadge row={row} />;
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button type="button" className="shrink-0">
          <TokenUsageBadge row={row} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 text-xs" align="end">
        <p className="font-medium text-foreground">
          {row.referenceCount} reference
          {row.referenceCount === 1 ? "" : "s"}
        </p>
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-muted-foreground">
          {row.usageFiles.slice(0, 12).map((f) => (
            <li key={f} className="min-w-0">
              <TruncatedPath path={f} className="text-xs" />
            </li>
          ))}
          {row.usageFiles.length > 12 ? (
            <li className="text-muted-foreground/80">+{row.usageFiles.length - 12} more</li>
          ) : null}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

function isSwatchColor(value: string | undefined): value is string {
  return value != null && /^(#|rgb|oklch|hsl)/.test(value.trim());
}

/** Semantic tokens like `--primary` are scanned as "other"; still show them as colors when values paint. */
function isColorWallRow(row: ScannedTokenRow): boolean {
  return (
    row.category === "color" ||
    isSwatchColor(row.displayValue) ||
    isSwatchColor(row.darkDisplayValue)
  );
}

function TokenRowBody({ row, className }: { row: ScannedTokenRow; className?: string }) {
  const hasDark = row.darkValue != null;

  return (
    <div className={cn("min-w-0", className)}>
      <p className="truncate font-mono text-xs text-foreground">{row.cssName}</p>
      {hasDark ? (
        <>
          <p className="truncate text-xs text-muted-foreground" title={row.value}>
            Light: {row.value}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={row.darkValue}>
            Dark: {row.darkValue}
          </p>
        </>
      ) : (
        <p className="truncate text-xs text-muted-foreground">{row.value}</p>
      )}
      {row.tw ? (
        <p className="truncate font-mono text-xs text-muted-foreground/70">{row.tw}</p>
      ) : null}
    </div>
  );
}

function ColorSwatch({ row }: { row: ScannedTokenRow }) {
  const light = isSwatchColor(row.displayValue) ? row.displayValue : null;
  const dark = isSwatchColor(row.darkDisplayValue) ? row.darkDisplayValue : null;

  if (light && dark) {
    return (
      <svg
        className="h-8 w-8 shrink-0 overflow-hidden rounded border border-border shadow-inner"
        viewBox="0 0 36 36"
        aria-hidden
      >
        <title>
          Light {light}; dark {dark}
        </title>
        <rect width="18" height="36" fill={light} />
        <rect x="18" width="18" height="36" fill={dark} />
      </svg>
    );
  }

  const sole = light ?? dark;
  if (sole) {
    return (
      <svg
        className="h-8 w-8 shrink-0 overflow-hidden rounded border border-border shadow-inner"
        viewBox="0 0 36 36"
        aria-hidden
      >
        <rect width="36" height="36" fill={sole} />
      </svg>
    );
  }

  return <div className="h-8 w-8 shrink-0 rounded border border-border bg-muted" />;
}

function ColorSection({ rows }: { rows: ScannedTokenRow[] }) {
  const colors = rows.filter(isColorWallRow);
  if (colors.length === 0) return null;

  return (
    <TokenSection
      title="Colors"
      subtitle="CSS custom properties from @theme, :root, and .dark."
    >
      <ul className="mt-4 grid gap-2" className:sm="grid-cols-2" className:xl="grid-cols-3">
        {colors.map((row) => (
          <li
            key={scannedTokenRowKey(row)}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2 pr-3"
            title={row.darkValue ? `Light: ${row.value}; Dark: ${row.darkValue}` : row.value}
          >
            <ColorSwatch row={row} />
            <TokenRowBody row={row} className="flex-1" />
            <TokenUsageHover row={row} />
          </li>
        ))}
      </ul>
    </TokenSection>
  );
}

function ListSection({
  title,
  subtitle,
  rows,
  category,
}: {
  title: string;
  subtitle: string;
  rows: ScannedTokenRow[];
  category: ScannedTokenRow["category"];
}) {
  const items = rows.filter((r) => {
    if (r.category !== category) return false;
    // Color-looking "other" tokens render in ColorSection instead.
    if (category === "other" && isColorWallRow(r)) return false;
    return true;
  });
  if (items.length === 0) return null;

  return (
    <TokenSection title={title} subtitle={subtitle}>
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((row) => (
          <li
            key={scannedTokenRowKey(row)}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
          >
            <TokenRowBody row={row} className="flex-1" />
            <TokenUsageHover row={row} />
          </li>
        ))}
      </ul>
    </TokenSection>
  );
}

export function ScannedTokenWall({ view }: { view: MergedTokenView }) {
  const [filter, setFilter] = useState<TokenUsageFilter>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(() => {
    const byUsage = filterTokenRows(view.rows, filter);
    return searchTokenRows(byUsage, deferredSearch);
  }, [view.rows, filter, deferredSearch]);
  const hasSearch = deferredSearch.trim().length > 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {view.usedCount}/{view.totalCount} theme tokens used
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Scanned from CSS sources
            {view.source === "hybrid" ? " · enriched with manual catalog" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full min-w-48" className:sm="w-56">
            <IconSearch
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tokens…"
              aria-label="Search tokens"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-0.5">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  filter === tab.id
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyCard>{emptyFilterMessage(filter, hasSearch)}</EmptyCard>
      ) : (
        <>
          <ColorSection rows={filtered} />
          <ListSection
            title="Spacing"
            subtitle="--spacing-* custom properties."
            rows={filtered}
            category="spacing"
          />
          <ListSection
            title="Radius"
            subtitle="--radius-* custom properties."
            rows={filtered}
            category="radius"
          />
          <ListSection
            title="Typography"
            subtitle="--font-* custom properties."
            rows={filtered}
            category="typography"
          />
          <ListSection
            title="Other"
            subtitle="Additional CSS variables."
            rows={filtered}
            category="other"
          />
        </>
      )}
    </section>
  );
}
