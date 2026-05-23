import { useMemo } from "react";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  aggregateDeclaredProps,
  aggregateDefinitions,
} from "../dashboard/aggregate";
import {
  buildUnusedPropSetForComponent,
  ComponentPropUsageDetail,
} from "../dashboard/ComponentPropUsageDetail";
import { ComponentUsageDetails } from "../dashboard/ComponentUsageDetails";
import { FindingsList } from "../dashboard/FindingsList";
import { shortPath } from "../dashboard/paths";
import { findingsForComponent } from "../report/findingsForComponent";
import type { WorkspaceReport } from "../types/report";
import type { PlaygroundJoinSkip } from "../playground/playgroundJoin";
import { findPlaygroundSpec } from "../playground/playgroundJoin";
import { Section } from "./Section";

type Props = {
  componentId: string;
  workspaceReport: WorkspaceReport | null;
  reportReady: boolean;
  hasPlaygroundSpec: boolean;
  /** When the report row exists but Vite could not load the module/export. */
  playgroundJoinSkip?: PlaygroundJoinSkip;
  onBackToGovernance: () => void;
};

export function ComponentInspectPane({
  componentId,
  workspaceReport,
  reportReady,
  hasPlaygroundSpec,
  playgroundJoinSkip,
  onBackToGovernance,
}: Props) {
  const playgroundSpec = findPlaygroundSpec(workspaceReport, componentId);
  const definitions = useMemo(() => {
    if (!workspaceReport) return [];
    return aggregateDefinitions(workspaceReport).get(componentId) ?? [];
  }, [workspaceReport, componentId]);

  const declared = useMemo(() => {
    if (!workspaceReport) return [];
    return aggregateDeclaredProps(workspaceReport).get(componentId) ?? [];
  }, [workspaceReport, componentId]);

  const unusedProps = useMemo(() => {
    if (!workspaceReport) return new Set<string>();
    return buildUnusedPropSetForComponent(
      workspaceReport,
      componentId,
      declared,
    );
  }, [workspaceReport, componentId, declared]);

  const findings = useMemo(
    () => findingsForComponent(workspaceReport, componentId),
    [workspaceReport, componentId],
  );

  const previewNote = hasPlaygroundSpec
    ? "A preview was expected for this component but the module could not be loaded in the dashboard bundle (check the file path, export name, or that npx dslinter was run from the project root)."
    : "No playable component definition was found";

  const joinDetail = (() => {
    if (playgroundJoinSkip?.reason === "module_not_found") {
      const { globKey, rel_path } = playgroundJoinSkip;
      const subdirHint = !rel_path.includes("/")
        ? " This usually means the scanner was run from a subdirectory. Re-run from the project root: npx dslinter ."
        : "";
      if (globKey.startsWith("@dslinter-scan/")) {
        return [
          `Expected module key "${globKey}" but the dslinter Vite plugin did not load it.`,
          `Use <DashboardLayout autoPlayground /> and run via npx dslinter (zero vite.config changes), or add plugins: [dslinter()] from dslinter/vite to vite.config.ts.`,
          `Run the scanner from the project root so rel_path "${rel_path}" matches files under DSLINTER_SCAN_ROOT.`,
        ].join(" ");
      }
      return [
        `Vite glob is missing key "${globKey}" for report path "${rel_path}".`,
        `Prefer <DashboardLayout autoPlayground /> with plugins: [dslinter()] from dslinter/vite, or run npx dslinter init for a custom buildRegistry.ts glob.`,
        subdirHint,
      ]
        .filter(Boolean)
        .join("");
    }
    if (playgroundJoinSkip?.reason === "export_not_found") {
      return `Module loaded but named export "${playgroundJoinSkip.export_name}" was not found. Use export function ${playgroundJoinSkip.export_name}(…) in ${playgroundJoinSkip.rel_path}.`;
    }
    if (playgroundSpec) {
      return `Report path: ${playgroundSpec.rel_path} (export ${playgroundSpec.export_name}). Use autoPlayground with dslinter/vite, or ensure buildRegistry.ts glob covers this file.`;
    }
    return null;
  })();

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
                {previewNote}
              </p>
              {joinDetail ? (
                <p className="mt-2 max-w-2xl font-mono text-xs text-muted-foreground">
                  {joinDetail}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onBackToGovernance}
            >
              Back to governance
            </Button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-10 px-8 py-8">
          <Section
            id="definitions"
            title="Definitions"
            description="Source files where this component is defined."
          >
            {definitions.length > 0 ? (
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
                      <TableCell className="font-mono text-xs">
                        {workspaceReport
                          ? shortPath(workspaceReport.root, site.path)
                          : site.path}
                      </TableCell>
                      <TableCell>{site.line}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {site.kind}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No definition sites recorded — this name may appear only from
                JSX usage.
              </p>
            )}
          </Section>

          <Section
            id="props"
            title="Props"
            description="Declared props and workspace usage from the latest scan."
          >
            {reportReady && workspaceReport ? (
              <ComponentPropUsageDetail
                component={componentId}
                declared={declared}
                unusedProps={unusedProps}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Load the DSLinter report to see prop usage.
              </p>
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
            {reportReady && workspaceReport ? (
              <FindingsList findings={findings} root={workspaceReport.root} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Load the DSLinter report to see findings.
              </p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
