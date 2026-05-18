import { useEffect, useMemo } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  aggregateDeclaredProps,
  aggregateDefinitions,
  catalogComponentNames,
  catalogRowDomId,
  usageMap,
} from "./aggregate";
import { shortPath } from "./paths";
import type { WorkspaceReport } from "../types/report";
import { pluralize } from "usemods";

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

const catalogHoverTriggerClass =
  "cursor-default text-xs underline decoration-dotted underline-offset-2 hover:text-foreground";

function CatalogPropUsageHover({
  component,
  declared,
  unusedProps,
  usedPropCount,
}: {
  component: string;
  declared: string[];
  unusedProps: Set<string>;
  usedPropCount: number;
}) {
  const used = declared.filter(
    (prop) => !unusedProps.has(`${component}/${prop}`),
  );
  const unused = declared.filter((prop) =>
    unusedProps.has(`${component}/${prop}`),
  );

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button type="button" className={catalogHoverTriggerClass}>
          <span className="text-muted-foreground">
            {usedPropCount}/{declared.length} {pluralize("prop", usedPropCount)}{" "}
            used
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-56 p-3">
        <p className="text-xs font-medium text-foreground">Props</p>
        {used.length > 0 ? (
          <div className="mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Used
            </p>
            <ul className="mt-1 space-y-0.5 font-mono text-xs text-foreground">
              {used.map((prop) => (
                <li key={prop}>{prop}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {unused.length > 0 ? (
          <div className={used.length > 0 ? "mt-3" : "mt-2"}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Never passed
            </p>
            <ul className="mt-1 space-y-0.5 font-mono text-xs text-muted-foreground/70">
              {unused.map((prop) => (
                <li key={prop} className="line-through">
                  {prop}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
            <li key={file} className="truncate" title={shortPath(root, file)}>
              {shortPath(root, file)}
            </li>
          ))}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}

export function ComponentCatalog({
  report,
  focusName,
}: {
  report: WorkspaceReport;
  focusName?: string;
}) {
  const defs = aggregateDefinitions(report);
  const usages = usageMap(report);
  const names = catalogComponentNames(defs, usages);
  const unusedProps = useMemo(() => buildUnusedPropSet(report), [report]);
  const declaredByName = useMemo(
    () => aggregateDeclaredProps(report),
    [report],
  );

  useEffect(() => {
    if (!focusName || !names.includes(focusName)) return;
    const el = document.getElementById(catalogRowDomId(focusName));
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusName, names]);

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
          const usedPropCount = declared.filter(
            (prop) => !unusedProps.has(`${name}/${prop}`),
          ).length;

          return (
            <TableRow key={name} id={catalogRowDomId(name)}>
              <TableCell>{name}</TableCell>

              <TableCell>
                {declared.length > 0 ? (
                  <CatalogPropUsageHover
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
