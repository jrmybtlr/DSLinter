import { Fragment, useMemo, useState } from "react";
import {
  aggregateDeclaredProps,
  aggregateDefinitions,
  catalogComponentNames,
  usageMap,
} from "./aggregate";
import { shortPath } from "./paths";
import type { WorkspaceReport } from "../types/report";

function kindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

/** Set of `"ComponentName/propName"` keys for every declared prop with no recorded usage. */
function buildUnusedPropSet(report: WorkspaceReport): Set<string> {
  const s = new Set<string>();
  const usageByComponent = new Map(
    (report.usage_by_component ?? []).map((usage) => [usage.component, usage.prop_frequencies ?? {}]),
  );

  for (const file of report.files ?? []) {
    for (const definition of file.definitions ?? []) {
      const componentName = definition.name;
      const propFrequencies = usageByComponent.get(componentName) ?? {};

      for (const propName of definition.declared_props ?? []) {
        if ((propFrequencies[propName] ?? 0) === 0) {
          s.add(`${componentName}/${propName}`);
        }
      }
    }
  }

  return s;
}

function PropFrequencyTable({
  component,
  frequencies,
  declared,
  unusedProps,
}: {
  component: string;
  frequencies: Record<string, number>;
  declared: string[];
  unusedProps: Set<string>;
}) {
  const merged = new Map<string, number>();
  for (const [k, v] of Object.entries(frequencies)) merged.set(k, v);
  for (const p of declared) if (!merged.has(p)) merged.set(p, 0);
  const entries = [...merged.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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

function formatCallSiteProps(loc: { props: string[]; prop_values?: Record<string, string> }): string {
  if (!loc.props.length) return "—";
  return loc.props
    .map((p) => (loc.prop_values?.[p] != null ? `${p}=${JSON.stringify(loc.prop_values[p])}` : p))
    .join(", ");
}

function CatalogUsageSitesTable({
  root,
  locations,
}: {
  root: string;
  locations: { path: string; line: number; props: string[]; prop_values?: Record<string, string> }[];
}) {
  if (locations.length === 0) return null;
  const rows = [...locations].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  return (
    <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
      <table className="w-full min-w-[28rem] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50/90">
            <th className="px-2 py-1.5 font-semibold text-neutral-600">File</th>
            <th className="w-12 px-2 py-1.5 font-semibold text-neutral-600">Line</th>
            <th className="px-2 py-1.5 font-semibold text-neutral-600">Props at call site</th>
          </tr>
        </thead>
        <tbody className="text-neutral-800">
          {rows.map((loc, i) => (
            <tr key={`${loc.path}-${loc.line}-${i}`} className="border-b border-neutral-100 last:border-0">
              <td className="px-2 py-1.5 font-mono text-[10px] text-neutral-700">{shortPath(root, loc.path)}</td>
              <td className="px-2 py-1.5 font-mono text-[10px] tabular-nums text-neutral-600">{loc.line}</td>
              <td className="px-2 py-1.5 font-mono text-[10px] leading-relaxed text-neutral-600">{formatCallSiteProps(loc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropValueFrequencyTable({
  values,
}: {
  values: Record<string, Record<string, number>> | undefined;
}) {
  if (!values) return null;
  const props = Object.entries(values).filter(([, byVal]) => Object.keys(byVal).length > 0);
  if (props.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        Prop Value Frequency (literals only)
      </p>
      <div className="mt-1 space-y-2">
        {props
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([prop, byVal]) => {
            const entries = Object.entries(byVal).sort((x, y) => y[1] - x[1]);
            return (
              <div key={prop} className="rounded border border-neutral-200/70 bg-neutral-50/40 p-2">
                <div className="font-mono text-[11px] text-neutral-700">{prop}</div>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {entries.slice(0, 12).map(([val, count]) => (
                    <li
                      key={`${prop}-${val}`}
                      className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 ring-1 ring-neutral-200/80"
                      title={`${count} call-sites`}
                    >
                      {JSON.stringify(val)} <span className="text-neutral-400">×{count}</span>
                    </li>
                  ))}
                  {entries.length > 12 && (
                    <li className="px-1.5 py-0.5 text-[10px] text-neutral-400">
                      +{entries.length - 12} more
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export function ComponentCatalog({ report }: { report: WorkspaceReport }) {
  const defs = aggregateDefinitions(report);
  const usages = usageMap(report);
  const names = catalogComponentNames(defs, usages);
  const unusedProps = useMemo(() => buildUnusedPropSet(report), [report]);
  const declaredByName = useMemo(() => aggregateDeclaredProps(report), [report]);
  const [openComponent, setOpenComponent] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-100 text-left text-xs">
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Component
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Defined
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Declared props
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Usage
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 align-top text-neutral-800">
            {names.map((name) => {
              const sites = defs.get(name) ?? [];
              const use = usages.get(name);
              const declared = declaredByName.get(name) ?? [];
              const isOpen = openComponent === name;
              return (
                <Fragment key={name}>
                  <tr>
                    <td className="px-3 py-2 font-medium text-neutral-900">
                      <span className="font-mono text-[11px]">{name}</span>
                    </td>

                    <td className="px-3 py-2 text-neutral-600">
                      {sites.length > 0 ? (
                        <ul className="space-y-1">
                          {sites.map((s, i) => (
                            <li
                              key={`${s.path}-${s.line}-${i}`}
                              className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                            >
                              <span className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[10px] text-neutral-600">
                                {kindLabel(s.kind)}
                              </span>
                              <span className="font-mono text-[11px] text-neutral-500">
                                {shortPath(report.root, s.path)}:{s.line}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-neutral-400">No definition captured.</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-neutral-600">
                      {declared.length > 0 ? (
                        <ul className="flex min-w-48 flex-wrap gap-1">
                          {declared.map((prop) => {
                            const isUnused = unusedProps.has(`${name}/${prop}`);
                            return (
                              <li
                                key={prop}
                                className={`rounded px-1.5 py-0.5 font-mono text-[10px] ring-1 ring-neutral-200/80 ${
                                  isUnused
                                    ? "bg-neutral-50 text-neutral-400 line-through"
                                    : "bg-neutral-50 text-neutral-700"
                                }`}
                                title={isUnused ? "Declared but never passed at any call site" : undefined}
                              >
                                {prop}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-neutral-600">
                      {use ? (
                        <span className="font-mono text-[11px] text-neutral-700">
                          ×{use.reference_count} refs · {use.file_count} files · max {use.max_props_on_single_use} props
                        </span>
                      ) : sites.length > 0 ? (
                        <span className="text-neutral-400">Not referenced in scanned JSX.</span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-neutral-600">
                      <button
                        type="button"
                        className="rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
                        onClick={() => setOpenComponent((cur) => (cur === name ? null : name))}
                      >
                        {isOpen ? "Close" : "Open"}
                      </button>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr>
                      <td colSpan={5} className="px-3 py-3">
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-3">
                          <div className="font-mono text-[12px] font-semibold text-neutral-800">{name}</div>

                          {use ? (
                            <>
                              <p className="mt-2 text-[11px] text-neutral-600">
                                <span className="font-mono text-neutral-800">×{use.reference_count}</span> references across{" "}
                                <span className="font-mono text-neutral-800">{use.file_count}</span> files
                                {use.max_props_on_single_use > 0 ? (
                                  <>
                                    ; up to <span className="font-mono text-neutral-800">{use.max_props_on_single_use}</span> props
                                    on one tag
                                  </>
                                ) : null}
                                .
                              </p>
                              <div className="mt-3">
                                <CatalogUsageSitesTable root={report.root} locations={use.usage_locations ?? []} />
                              </div>
                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                  <PropFrequencyTable
                                    component={name}
                                    frequencies={use.prop_frequencies ?? {}}
                                    declared={declared}
                                    unusedProps={unusedProps}
                                  />
                                </div>
                                <div>
                                  <PropValueFrequencyTable values={use.prop_value_frequencies} />
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="mt-2 text-[11px] text-neutral-400">No scanned JSX references found.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
