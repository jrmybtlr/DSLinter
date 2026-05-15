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
import { EmptyCard } from "../shell/EmptyCard";
import { InlineCode } from "@/components/InlineCode";

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
      <p className="text-sm text-muted-foreground">
        Load <span className="font-mono">dslint-report.json</span> to see where
        this component is used in the workspace.
      </p>
    );
  }

  if (!usage) {
    return (
      <EmptyCard>
        No found usage for <InlineCode>{componentId}</InlineCode>.
      </EmptyCard>
    );
  }

  const rows = sortedLocations(usage.usage_locations);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Usage totals exist but individual call sites were not recorded in this
        report.
      </p>
    );
  }

  return (
    <Table className="[&>table]:table-fixed [&>table]:w-full">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">File</TableHead>
          <TableHead className="w-14 whitespace-nowrap">Line</TableHead>
          <TableHead className="min-w-0">Props at this call site</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((loc, i) => {
          const propsText = formatCallSiteProps(loc);
          return (
            <TableRow key={`${loc.path}-${loc.line}-${i}`}>
              <TableCell className="font-mono text-xs text-foreground">
                {shortPath(report.root, loc.path)}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">
                {loc.line}
              </TableCell>
              <TableCell className="min-w-0">
                <span
                  className="block truncate font-mono text-xs text-foreground"
                  title={propsText}
                >
                  {propsText}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
