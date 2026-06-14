import { useMemo } from "react";
import {
  aggregateDeclaredProps,
  aggregateDefinitions,
  catalogChildComponentsFor,
  componentCatalogFamilyForName,
  type DefinitionSite,
} from "../dashboard/aggregate";
import {
  buildUnusedPropSetForComponent,
  ComponentPropUsageDetail,
  propFrequenciesForComponent,
} from "../dashboard/ComponentPropUsageDetail";
import { ComponentUsageDetails } from "../dashboard/ComponentUsageDetails";
import { FindingsList } from "../dashboard/FindingsList";
import { shortPath } from "../dashboard/paths";
import { findingsForComponent } from "../report/findingsForComponent";
import {
  findPlaygroundSpec,
  playgroundJoinDetailMessage,
  type PlaygroundJoinSkip,
} from "../playground/playgroundJoin";
import type { WorkspaceReport } from "../types/report";
import { HideFromCatalogButton } from "./HideFromCatalogButton";
import { Section } from "./Section";
import { TruncatedPath } from "./TruncatedPath";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type Props = {
  componentId: string;
  workspaceReport: WorkspaceReport | null;
  reportReady: boolean;
  hasPlaygroundSpec: boolean;
  playgroundJoinSkip?: PlaygroundJoinSkip;
  onOpenComponent: (componentId: string) => void;
  onHideFromCatalog?: (componentId: string) => void;
};

const PREVIEW_NOTE = {
  missing: "No playable component definition was found",
  unloadable:
    "A preview was expected for this component but the module could not be loaded in the dashboard bundle (check the file path, export name, or that npx dslinter was run from the project root).",
} as const;

function reportPlaceholder(message: string) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

function DefinitionsTable({
  definitions,
  root,
}: {
  definitions: DefinitionSite[];
  root: string | undefined;
}) {
  if (definitions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No definition sites recorded — this name may appear only from JSX usage.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead className="w-20">Line</TableHead>
          <TableHead>Kind</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {definitions.map((site) => (
          <TableRow key={`${site.path}:${site.line}:${site.kind}`}>
            <TableCell className="min-w-0 font-mono text-xs">
              <TruncatedPath
                path={root ? shortPath(root, site.path) : site.path}
                className="text-xs"
              />
            </TableCell>
            <TableCell>{site.line}</TableCell>
            <TableCell className="text-muted-foreground">{site.kind}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ComponentInspectPane({
  componentId,
  workspaceReport,
  reportReady,
  hasPlaygroundSpec,
  playgroundJoinSkip,
  onOpenComponent,
  onHideFromCatalog,
}: Props) {
  const report = reportReady ? workspaceReport : null;
  const playgroundSpec = findPlaygroundSpec(workspaceReport, componentId);
  const joinDetail = playgroundJoinDetailMessage(
    playgroundJoinSkip,
    playgroundSpec,
  );

  const {
    definitions,
    declared,
    unusedProps,
    propFrequencies,
    findings,
    childComponents,
  } = useMemo(() => {
    if (!workspaceReport) {
      return {
        definitions: [] as DefinitionSite[],
        declared: [] as string[],
        unusedProps: new Set<string>(),
        propFrequencies: {},
        findings: [],
        childComponents: [] as string[],
      };
    }

    const declared =
      aggregateDeclaredProps(workspaceReport).get(componentId) ?? [];
    const family = componentCatalogFamilyForName(workspaceReport, componentId);

    return {
      definitions:
        aggregateDefinitions(workspaceReport).get(componentId) ?? [],
      declared,
      unusedProps: buildUnusedPropSetForComponent(
        workspaceReport,
        componentId,
        declared,
      ),
      propFrequencies: propFrequenciesForComponent(workspaceReport, componentId),
      findings: findingsForComponent(workspaceReport, componentId),
      childComponents: catalogChildComponentsFor(family, componentId),
    };
  }, [workspaceReport, componentId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="min-h-0 flex-1 overflow-auto">
        <header className="border-b border-border bg-card px-8 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                Components
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {componentId}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {hasPlaygroundSpec ? PREVIEW_NOTE.unloadable : PREVIEW_NOTE.missing}
              </p>
              {joinDetail ? (
                <p className="mt-2 max-w-2xl font-mono text-xs text-muted-foreground">
                  {joinDetail}
                </p>
              ) : null}
            </div>
            {onHideFromCatalog ? (
              <HideFromCatalogButton
                componentName={componentId}
                onHidden={onHideFromCatalog}
              />
            ) : null}
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-10 px-8 py-8">
          <Section
            id="definitions"
            title="Definitions"
            description="Source files where this component is defined."
          >
            <DefinitionsTable
              definitions={definitions}
              root={workspaceReport?.root}
            />
          </Section>

          {childComponents.length > 0 ? (
            <Section
              id="subcomponents"
              title="Subcomponents"
              description="Related exports detected in the same compound component module."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {childComponents.map((child) => (
                  <button
                    key={child}
                    type="button"
                    onClick={() => onOpenComponent(child)}
                    className="rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    {child}
                  </button>
                ))}
              </div>
            </Section>
          ) : null}

          <Section
            id="props"
            title="Props"
            description="Declared props and workspace usage from the latest scan."
          >
            {report ? (
              <ComponentPropUsageDetail
                component={componentId}
                declared={declared}
                unusedProps={unusedProps}
                propFrequencies={propFrequencies}
              />
            ) : (
              reportPlaceholder("Load the DSLinter report to see prop usage.")
            )}
          </Section>

          <Section
            id="usage"
            title="App usage"
            description="Where this component is used in the workspace."
          >
            <ComponentUsageDetails
              report={workspaceReport}
              componentId={componentId}
            />
          </Section>

          <Section
            id="findings"
            title="Findings"
            description="DSLinter findings on files where this component is defined."
          >
            {report ? (
              <FindingsList findings={findings} root={report.root} />
            ) : (
              reportPlaceholder("Load the DSLinter report to see findings.")
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
