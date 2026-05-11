import { useMemo } from "react";
import type { UsageLocation, WorkspaceReport } from "../types/report";
import { usageMap } from "./aggregate";
import { shortPath } from "./paths";

function formatCallSiteProps(loc: UsageLocation): string {
  if (!loc.props.length) return "—";
  return loc.props
    .map((p) => (loc.prop_values?.[p] != null ? `${p}=${JSON.stringify(loc.prop_values[p])}` : p))
    .join(", ");
}

function sortedLocations(locations: UsageLocation[] | undefined): UsageLocation[] {
  const list = [...(locations ?? [])];
  list.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  return list;
}

export function ComponentUsageDetails({
  report,
  componentId,
}: {
  report: WorkspaceReport | null;
  componentId: string;
}) {
  const usage = useMemo(() => {
    if (!report) return undefined;
    return usageMap(report).get(componentId);
  }, [report, componentId]);

  if (!report) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Load <span className="font-mono">dslint-report.json</span> to see where this component is referenced in the workspace.
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        No scanned JSX references found for <span className="font-mono text-slate-800">{componentId}</span>.
      </div>
    );
  }

  const rows = sortedLocations(usage.usage_locations);
  const hasSites = rows.length > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-600">
        <span className="font-mono text-slate-900">×{usage.reference_count}</span>{" "}
        <span className="text-slate-400">references</span> across{" "}
        <span className="font-mono text-slate-900">{usage.file_count}</span>{" "}
        <span className="text-slate-400">{usage.file_count === 1 ? "file" : "files"}</span>
        {usage.max_props_on_single_use > 0 ? (
          <>
            . Busiest call site passes up to{" "}
            <span className="font-mono text-slate-900">{usage.max_props_on_single_use}</span>{" "}
            <span className="text-slate-400">props</span>.
          </>
        ) : (
          <> (no props recorded on any tag — self-closing or spread-only).</>
        )}
      </p>

      {hasSites ? (
        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[32rem] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-3 py-2.5 font-semibold text-slate-700">File</th>
                <th className="w-16 px-3 py-2.5 font-semibold text-slate-700">Line</th>
                <th className="px-3 py-2.5 font-semibold text-slate-700">Props at this call site</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {rows.map((loc, i) => (
                <tr key={`${loc.path}-${loc.line}-${i}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2.5 font-mono text-[12px] text-slate-700">{shortPath(report.root, loc.path)}</td>
                  <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums text-slate-600">{loc.line}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-600">{formatCallSiteProps(loc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Usage counts are present but individual call sites were not recorded in this report. Regenerate with a current{" "}
          <span className="font-mono">dslint</span> build if you expect a site list.
        </p>
      )}
    </div>
  );
}

