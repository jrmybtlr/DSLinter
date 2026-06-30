import { useMemo } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../components/ui/hover-card";
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
import {
  catalogAttributeProps,
  ComponentPropUsageDetail,
  buildUnusedPropSetForComponent,
  propFrequenciesForComponent,
} from "./ComponentPropUsageDetail";
import { shortPath } from "./paths";
import type { WorkspaceReport } from "../types/report";
import { pluralize } from "usemods";
import { TruncatedPath } from "../components/TruncatedPath";

const catalogHoverTriggerClass =
  "cursor-default text-xs underline decoration-dotted underline-offset-2 hover:text-foreground";

function CatalogPropUsageHover({
  report,
  component,
  declared,
  unusedProps,
  usedPropCount,
}: {
  report: WorkspaceReport;
  component: string;
  declared: string[];
  unusedProps: Set<string>;
  usedPropCount: number;
}) {
  const attributeProps = catalogAttributeProps(declared);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button type="button" className={catalogHoverTriggerClass}>
          <span className="text-muted-foreground">
            {usedPropCount}/{attributeProps.length}{" "}
            {pluralize("prop", usedPropCount)} used
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-64 p-3">
        <ComponentPropUsageDetail
          component={component}
          declared={declared}
          unusedProps={unusedProps}
          propFrequencies={propFrequenciesForComponent(
            report,
            component,
          )}
          variant="compact"
        />
      </HoverCardContent>
    </HoverCard>
  );
}

function CatalogAppUsageHover({
  root,
  fileCount,
  files,
}: {
  root: string;
  fileCount: number;
  files: string[];
}) {
  const sortedFiles = [...files].sort((a, b) => a.localeCompare(b));

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button type="button" className={catalogHoverTriggerClass}>
          {fileCount} {pluralize("file", fileCount)}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 p-3">
        <p className="text-xs font-medium text-foreground">
          {fileCount} {pluralize("file", fileCount)}
        </p>
        <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto font-mono text-xs text-muted-foreground">
          {sortedFiles.map((file) => (
            <li key={file} className="min-w-0">
              <TruncatedPath
                path={shortPath(root, file)}
                className="text-xs text-muted-foreground"
              />
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

export function ComponentCatalog({
  report,
  onOpenComponent,
}: {
  report: WorkspaceReport;
  onOpenComponent?: (name: string) => void;
}) {
  const defs = aggregateDefinitions(report);
  const usages = usageMap(report);
  const names = catalogComponentNames(defs, usages, report);
  const { unusedProps, declaredByName } = useMemo(() => {
    const declaredByName = aggregateDeclaredProps(report);
    const unusedProps = new Set<string>();
    for (const [componentName, declared] of declaredByName) {
      const unused = buildUnusedPropSetForComponent(report, componentName, declared);
      for (const key of unused) unusedProps.add(key);
    }
    return { unusedProps, declaredByName };
  }, [report]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Component</TableHead>
          <TableHead scope="col">Prop Usage</TableHead>
          <TableHead scope="col">App Usage</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {names.map((name) => {
          const use = usages.get(name);
          const declared = declaredByName.get(name) ?? [];
          const attributeProps = catalogAttributeProps(declared);
          const usedPropCount = attributeProps.filter(
            (prop) => !unusedProps.has(`${name}/${prop}`),
          ).length;

          return (
            <TableRow key={name}>
              <TableCell>
                {onOpenComponent ? (
                  <button
                    type="button"
                    onClick={() => onOpenComponent(name)}
                    className="text-left font-medium text-foreground underline decoration-transparent underline-offset-2 transition hover:decoration-current"
                  >
                    {name}
                  </button>
                ) : (
                  name
                )}
              </TableCell>

              <TableCell>
                {attributeProps.length > 0 ? (
                  <CatalogPropUsageHover
                    report={report}
                    component={name}
                    declared={declared}
                    unusedProps={unusedProps}
                    usedPropCount={usedPropCount}
                  />
                ) : (
                  <span className="text-muted-foreground/70">—</span>
                )}
              </TableCell>

              <TableCell>
                {use && use.files.length > 0 ? (
                  <CatalogAppUsageHover
                    root={report.root}
                    fileCount={use.file_count}
                    files={use.files}
                  />
                ) : (
                  <span className="text-muted-foreground/70">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
