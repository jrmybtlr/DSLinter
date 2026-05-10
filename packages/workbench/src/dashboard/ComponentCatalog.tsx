import { useMemo, useState } from "react";
import { aggregateDefinitions, catalogComponentNames, usageMap } from "./aggregate";
import { shortPath } from "./paths";
import type { WorkspaceReport } from "../types/report";

function kindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

/** Set of `"ComponentName/propName"` keys for every unused-prop finding. */
function buildUnusedPropSet(report: WorkspaceReport): Set<string> {
  const s = new Set<string>();
  for (const f of report.findings) {
    if (f.rule_id !== "unused-prop") continue;
    // Message format: "`ComponentName` prop `propName` is declared …"
    const m = f.message.match(/^`([^`]+)` prop `([^`]+)`/);
    if (m) s.add(`${m[1]}/${m[2]}`);
  }
  return s;
}

function PropFrequencyTable({
  component,
  frequencies,
  unusedProps,
}: {
  component: string;
  frequencies: Record<string, number>;
  unusedProps: Set<string>;
}) {
  const entries = Object.entries(frequencies).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        Prop Frequency
      </p>
      <ul className="mt-1 space-y-0.5">
        {entries.map(([prop, count]) => {
          const isUnused = unusedProps.has(`${component}/${prop}`);
          return (
            <li
              key={prop}
              className={`flex items-center justify-between gap-2 font-mono text-[11px] ${isUnused ? "opacity-40 line-through" : "text-neutral-700"}`}
              title={isUnused ? "Declared but never passed at any call site" : undefined}
            >
              <span>{prop}</span>
              <span className="tabular-nums text-neutral-500">×{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function UsageLocationsList({
  root,
  locations,
}: {
  root: string;
  locations: { path: string; line: number; props: string[] }[];
}) {
  const [open, setOpen] = useState(false);
  if (locations.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-600"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="transition-transform" style={{ display: "inline-block", transform: open ? "rotate(90deg)" : undefined }}>
          ▶
        </span>
        Usage sites ({locations.length})
      </button>
      {open && (
        <ul className="mt-1 max-h-36 space-y-0.5 overflow-y-auto">
          {locations.map((loc, i) => (
            <li key={`${loc.path}-${loc.line}-${i}`} className="flex flex-col gap-0.5">
              <span className="font-mono text-[11px] text-neutral-500">
                {shortPath(root, loc.path)}:{loc.line}
              </span>
              {loc.props.length > 0 && (
                <span className="font-mono text-[10px] text-neutral-400">
                  {loc.props.join(", ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ComponentCatalog({ report }: { report: WorkspaceReport }) {
  const defs = aggregateDefinitions(report);
  const usages = usageMap(report);
  const names = catalogComponentNames(defs, usages);
  const unusedProps = useMemo(() => buildUnusedPropSet(report), [report]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {names.map((name) => {
        const sites = defs.get(name) ?? [];
        const use = usages.get(name);
        return (
          <article
            key={name}
            className="flex flex-col rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
          >
            <h3 className="font-medium leading-tight text-neutral-900">{name}</h3>

            <div className="mt-3 space-y-2 text-xs text-neutral-600">
              {sites.length > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    Defined
                  </p>
                  <ul className="mt-1 space-y-1">
                    {sites.map((s, i) => (
                      <li key={`${s.path}-${s.line}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[10px] text-neutral-600">
                          {kindLabel(s.kind)}
                        </span>
                        <span className="font-mono text-[11px] text-neutral-500">
                          {shortPath(report.root, s.path)}:{s.line}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-neutral-400">No definition captured (usage-only / external).</p>
              )}

              {use ? (
                <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                      Usage
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-neutral-700">
                      ×{use.reference_count} refs · {use.file_count} files · max {use.max_props_on_single_use}{" "}
                      props
                    </p>
                  </div>
                  {use.prop_frequencies && Object.keys(use.prop_frequencies).length > 0 && (
                    <PropFrequencyTable
                      component={name}
                      frequencies={use.prop_frequencies}
                      unusedProps={unusedProps}
                    />
                  )}
                  {use.usage_locations && use.usage_locations.length > 0 && (
                    <UsageLocationsList root={report.root} locations={use.usage_locations} />
                  )}
                </>
              ) : sites.length > 0 ? (
                <p className="text-neutral-400">Not referenced in scanned JSX.</p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
