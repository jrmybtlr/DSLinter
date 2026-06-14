import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { cn } from "../lib/utils";
import type { WorkspaceReport } from "../types/report";
import { pluralize } from "usemods";

/** React slot props — not attribute props. */
const SLOT_PROPS = new Set(["children"]);

export function catalogAttributeProps(props: string[]): string[] {
  return props.filter((prop) => !SLOT_PROPS.has(prop));
}

export function propFrequenciesForComponent(
  report: WorkspaceReport,
  componentName: string,
): Record<string, number> {
  const usageRow = (report.usage_by_component ?? []).find(
    (u) => u.component === componentName,
  );
  return usageRow?.prop_frequencies ?? {};
}

/** Set of `"ComponentName/propName"` keys for props with no recorded usage. */
export function buildUnusedPropSetForComponent(
  report: WorkspaceReport,
  componentName: string,
  declared: string[],
): Set<string> {
  const s = new Set<string>();
  const propFrequencies = propFrequenciesForComponent(report, componentName);
  for (const propName of catalogAttributeProps(declared)) {
    if ((propFrequencies[propName] ?? 0) === 0) {
      s.add(`${componentName}/${propName}`);
    }
  }
  return s;
}

function sortedAttributeProps(declared: string[]): string[] {
  return [...catalogAttributeProps(declared)].sort((a, b) =>
    a.localeCompare(b),
  );
}

function PropUsageSummary({
  usedPropCount,
  totalPropCount,
}: {
  usedPropCount: number;
  totalPropCount: number;
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {usedPropCount}/{totalPropCount} {pluralize("prop", usedPropCount)} used
      in the workspace snapshot.
    </p>
  );
}

function PropUsageTable({
  props,
  propFrequencies,
}: {
  props: string[];
  propFrequencies: Record<string, number>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Prop</TableHead>
          <TableHead className="w-20 text-right">Uses</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.map((prop) => {
          const count = propFrequencies[prop] ?? 0;
          const isUnused = count === 0;
          return (
            <TableRow
              key={prop}
              className={isUnused ? "text-muted-foreground" : undefined}
            >
              <TableCell className="font-mono text-xs">{prop}</TableCell>
              <TableCell className="text-right tabular-nums">{count}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function PropUsageBadges({
  props,
  propFrequencies,
}: {
  props: string[];
  propFrequencies: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {props.map((prop) => {
        const count = propFrequencies[prop] ?? 0;
        const isUsed = count > 0;
        return (
          <Badge
            key={prop}
            variant={isUsed ? "secondary" : "outline"}
            size="sm"
            className={cn(!isUsed && "text-muted-foreground")}
            title={isUsed ? `${count} uses` : "Never passed"}
          >
            {prop}
          </Badge>
        );
      })}
    </div>
  );
}

export function ComponentPropUsageDetail({
  component,
  declared,
  unusedProps,
  propFrequencies = {},
  variant = "table",
}: {
  component: string;
  declared: string[];
  unusedProps: Set<string>;
  propFrequencies?: Record<string, number>;
  variant?: "table" | "compact";
}) {
  const attributeProps = sortedAttributeProps(declared);
  const usedPropCount = attributeProps.filter(
    (prop) => !unusedProps.has(`${component}/${prop}`),
  ).length;

  if (attributeProps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No declared props recorded for this component.
      </p>
    );
  }

  return (
    <div className={variant === "compact" ? "space-y-2" : "space-y-4"}>
      <PropUsageSummary
        usedPropCount={usedPropCount}
        totalPropCount={attributeProps.length}
      />
      {variant === "compact" ? (
        <PropUsageBadges
          props={attributeProps}
          propFrequencies={propFrequencies}
        />
      ) : (
        <PropUsageTable
          props={attributeProps}
          propFrequencies={propFrequencies}
        />
      )}
    </div>
  );
}
