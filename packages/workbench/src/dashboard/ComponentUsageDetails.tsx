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
        <div className="mt-4 rounded-md border border-border">
          <Table className="min-w-72 border-collapse text-left">
            <TableHeader>
              <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                  File
                </TableHead>
                <TableHead className="h-auto w-16 px-3 py-2.5 font-semibold text-muted-foreground">
                  Line
                </TableHead>
                <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                  Props at this call site
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-foreground">
              {rows.map((loc, i) => (
                <TableRow
                  key={`${loc.path}-${loc.line}-${i}`}
                  className="border-border hover:bg-transparent"
                >
                  <TableCell className="px-3 py-2.5 font-mono text-xs">
                    {shortPath(report.root, loc.path)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-xs tabular-nums text-muted-foreground">
                    {loc.line}
                  </TableCell>
                  <TableCell className="whitespace-normal px-3 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
                    {formatCallSiteProps(loc)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
