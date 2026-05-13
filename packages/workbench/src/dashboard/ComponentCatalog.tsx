import { Fragment, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
    (report.usage_by_component ?? []).map((usage) => [
      usage.component,
      usage.prop_frequencies ?? {},
    ]),
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
  const entries = [...merged.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Prop Frequency
      </p>
      <ul className="mt-1 space-y-0.5">
        {entries.map(([prop, count]) => {
          const isUnused = unusedProps.has(`${component}/${prop}`);
          return (
            <li
              key={prop}
              className={`flex items-center justify-between gap-2 font-mono text-xs ${isUnused ? "opacity-40 line-through" : "text-neutral-700"}`}
              title={
                isUnused
                  ? "Declared but never passed at any call site"
                  : undefined
              }
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

function formatCallSiteProps(loc: {
  props: string[];
  prop_values?: Record<string, string>;
}): string {
  if (!loc.props.length) return "—";
  return loc.props
    .map((p) =>
      loc.prop_values?.[p] != null
        ? `${p}=${JSON.stringify(loc.prop_values[p])}`
        : p,
    )
    .join(", ");
}

function CatalogUsageSitesTable({
  root,
  locations,
}: {
  root: string;
  locations: {
    path: string;
    line: number;
    props: string[];
    prop_values?: Record<string, string>;
  }[];
}) {
  if (locations.length === 0) return null;
  const rows = [...locations].sort(
    (a, b) => a.path.localeCompare(b.path) || a.line - b.line,
  );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead>Line</TableHead>
          <TableHead>Props at call site</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((loc, i) => (
          <TableRow key={`${loc.path}-${loc.line}-${i}`}>
            <TableCell>{shortPath(root, loc.path)}</TableCell>
            <TableCell>{loc.line}</TableCell>
            <TableCell>{formatCallSiteProps(loc)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PropValueFrequencyTable({
  values,
}: {
  values: Record<string, Record<string, number>> | undefined;
}) {
  if (!values) return null;
  const props = Object.entries(values).filter(
    ([, byVal]) => Object.keys(byVal).length > 0,
  );
  if (props.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Prop Value Frequency (literals only)
      </p>
      <div className="mt-1 space-y-2">
        {props
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([prop, byVal]) => {
            const entries = Object.entries(byVal).sort((x, y) => y[1] - x[1]);
            return (
              <div
                key={prop}
                className="rounded border border-neutral-200/70 bg-neutral-50/40 p-2"
              >
                <div className="font-mono text-xs text-neutral-700">{prop}</div>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {entries.slice(0, 12).map(([val, count]) => (
                    <li
                      key={`${prop}-${val}`}
                      className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-700 ring-1 ring-neutral-200/80"
                      title={`${count} call-sites`}
                    >
                      {JSON.stringify(val)}{" "}
                      <span className="text-neutral-400">×{count}</span>
                    </li>
                  ))}
                  {entries.length > 12 && (
                    <li className="px-1.5 py-0.5 text-xs text-neutral-400">
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
  const declaredByName = useMemo(
    () => aggregateDeclaredProps(report),
    [report],
  );
  const [openComponent, setOpenComponent] = useState<string | null>(null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Component</TableHead>
          <TableHead scope="col">Defined</TableHead>
          <TableHead scope="col">Declared props</TableHead>
          <TableHead scope="col">Usage</TableHead>
          <TableHead scope="col">Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {names.map((name) => {
          const sites = defs.get(name) ?? [];
          const use = usages.get(name);
          const declared = declaredByName.get(name) ?? [];
          const isOpen = openComponent === name;
          return (
            <Fragment key={name}>
              <TableRow>
                <TableCell>{name}</TableCell>

                <TableCell>
                  {sites.length > 0 ? (
                    <ul className="space-y-1">
                      {sites.map((s, i) => (
                        <li key={`${s.path}-${s.line}-${i}`}>
                          {kindLabel(s.kind)}
                          {shortPath(report.root, s.path)}:{s.line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground/70">
                      No definition captured.
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  {declared.length > 0 ? (
                    <ul>
                      {declared.map((prop) => {
                        const isUnused = unusedProps.has(`${name}/${prop}`);
                        return (
                          <li
                            key={prop}
                            className={`rounded px-1.5 py-0.5 font-mono text-xs ring-1 ring-border ${
                              isUnused
                                ? "bg-muted/50 text-muted-foreground/70 line-through"
                                : "bg-muted/80 text-foreground"
                            }`}
                            title={
                              isUnused
                                ? "Declared but never passed at any call site"
                                : undefined
                            }
                          >
                            {prop}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground/70">—</span>
                  )}
                </TableCell>

                <TableCell>
                  {use ? (
                    <span className="font-mono text-xs">
                      ×{use.reference_count} refs · {use.file_count} files · max{" "}
                      {use.max_props_on_single_use} props
                    </span>
                  ) : sites.length > 0 ? (
                    <span className="text-muted-foreground/70">
                      Not referenced in scanned JSX.
                    </span>
                  ) : (
                    <span className="text-muted-foreground/70">—</span>
                  )}
                </TableCell>

                <TableCell>
                  <button
                    type="button"
                    className="rounded border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted/50"
                    onClick={() =>
                      setOpenComponent((cur) => (cur === name ? null : name))
                    }
                  >
                    {isOpen ? "Close" : "Open"}
                  </button>
                </TableCell>
              </TableRow>

              {isOpen && (
                <TableRow>
                  <TableCell colSpan={5} className="p-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="font-mono text-xs font-semibold text-foreground">
                        {name}
                      </div>

                      {use ? (
                        <>
                          <p className="mt-2 text-xs text-muted-foreground">
                            <span className="font-mono text-foreground">
                              ×{use.reference_count}
                            </span>{" "}
                            references across{" "}
                            <span className="font-mono text-foreground">
                              {use.file_count}
                            </span>{" "}
                            files
                            {use.max_props_on_single_use > 0 ? (
                              <>
                                ; up to{" "}
                                <span className="font-mono text-foreground">
                                  {use.max_props_on_single_use}
                                </span>{" "}
                                props on one tag
                              </>
                            ) : null}
                            .
                          </p>
                          <div className="mt-3">
                            <CatalogUsageSitesTable
                              root={report.root}
                              locations={use.usage_locations ?? []}
                            />
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
                              <PropValueFrequencyTable
                                values={use.prop_value_frequencies}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground/70">
                          No scanned JSX references found.
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
