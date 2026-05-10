import { aggregateDefinitions, catalogComponentNames, usageMap } from "./aggregate";
import { shortPath } from "./paths";
import type { WorkspaceReport } from "../types/report";

function kindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

export function ComponentCatalog({ report }: { report: WorkspaceReport }) {
  const defs = aggregateDefinitions(report);
  const usages = usageMap(report);
  const names = catalogComponentNames(defs, usages);

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
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    Usage
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-neutral-700">
                    ×{use.reference_count} refs · {use.file_count} files · max {use.max_props_on_single_use}{" "}
                    props
                  </p>
                </div>
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
