import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import type { UsageLocation, WorkspaceReport } from "../types/report";
import { usageMap } from "./aggregate";
import { shortPath } from "./paths";

function formatCallSiteProps(loc: UsageLocation): string {
  if (!loc.props.length) return "—";
  return loc.props
    .map((p) =>
      loc.prop_values?.[p] != null
        ? `${p}=${JSON.stringify(loc.prop_values[p])}`
        : p,
    )
    .join(", ");
}

function sortedLocations(
  locations: UsageLocation[] | undefined,
): UsageLocation[] {
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
      <div className="rounded-lg border  bg-white p-4 text-sm text-gray-500">
        Load <span className="font-mono">dslint-report.json</span> to see where
        this component is referenced in the workspace.
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="rounded-lg border  bg-white p-4 text-sm text-gray-500">
        No scanned JSX references found for{" "}
        <span className="font-mono text-gray-800">{componentId}</span>.
      </div>
    );
  }

  const rows = sortedLocations(usage.usage_locations);
  const hasSites = rows.length > 0;

  return (
    <div className="rounded-lg border  bg-white p-4 shadow-xs">
      <p className="text-sm text-gray-600">
        <span className="font-mono text-gray-900">
          ×{usage.reference_count}
        </span>{" "}
        <span className="text-gray-400">references</span> across{" "}
        <span className="font-mono text-gray-900">{usage.file_count}</span>{" "}
        <span className="text-gray-400">
          {usage.file_count === 1 ? "file" : "files"}
        </span>
        {usage.max_props_on_single_use > 0 ? (
          <>
            . Busiest call site passes up to{" "}
            <span className="font-mono text-gray-900">
              {usage.max_props_on_single_use}
            </span>{" "}
            <span className="text-gray-400">props</span>.
          </>
        ) : (
          <> (no props recorded on any tag — self-closing or spread-only).</>
        )}
      </p>

      {hasSites ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>Props at this call site</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((loc, i) => (
              <TableRow key={`${loc.path}-${loc.line}-${i}`}>
                <TableCell>{shortPath(report.root, loc.path)}</TableCell>
                <TableCell>{loc.line}</TableCell>
                <TableCell>{formatCallSiteProps(loc)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          Usage counts are present but individual call sites were not recorded
          in this report. Regenerate with a current{" "}
          <span className="font-mono">dslint</span> build if you expect a site
          list.
        </p>
      )}
    </div>
  );
}
