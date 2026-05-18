import { useMemo, useState, type ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "../lib/utils";
import { shortPath } from "./paths";
import {
  filterTokenRows,
  type MergedTokenView,
  type ScannedTokenRow,
  type TokenUsageFilter,
} from "./mergeTokenCatalog";

const filterTabs: { id: TokenUsageFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "used", label: "Used" },
  { id: "unused", label: "Unused" },
];

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
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        unused
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
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
            <li key={f} className="truncate font-mono">
              {shortPath(f)}
            </li>
          ))}
          {row.usageFiles.length > 12 ? (
            <li className="text-muted-foreground/80">
              +{row.usageFiles.length - 12} more
            </li>
          ) : null}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

function TokenRowBody({
  row,
  className,
}: {
  row: ScannedTokenRow;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="truncate font-mono text-xs text-foreground">{row.cssName}</p>
      <p className="truncate text-xs text-muted-foreground">{row.value}</p>
      {row.tw ? (
        <p className="truncate font-mono text-xs text-muted-foreground/70">
          {row.tw}
        </p>
      ) : null}
    </div>
  );
}

function ColorSection({ rows }: { rows: ScannedTokenRow[] }) {
  const colors = rows.filter((r) => r.category === "color");
  if (colors.length === 0) return null;

  return (
    <TokenSection
      title="Colors"
      subtitle="CSS custom properties from @theme and :root."
    >
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {colors.map((row) => (
          <li
            key={row.cssName}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
            title={row.value}
          >
            {row.displayValue &&
            /^(#|rgb|oklch|hsl)/.test(row.displayValue.trim()) ? (
              <svg
                className="h-9 w-9 shrink-0 overflow-hidden rounded border border-border shadow-inner"
                viewBox="0 0 36 36"
                aria-hidden
              >
                <rect width="36" height="36" fill={row.displayValue} />
              </svg>
            ) : (
              <div className="h-9 w-9 shrink-0 rounded border border-border bg-muted" />
            )}
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
  const items = rows.filter((r) => r.category === category);
  if (items.length === 0) return null;

  return (
    <TokenSection title={title} subtitle={subtitle}>
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((row) => (
          <li
            key={row.cssName}
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
  const filtered = useMemo(
    () => filterTokenRows(view.rows, filter),
    [view.rows, filter],
  );

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
    </section>
  );
}
