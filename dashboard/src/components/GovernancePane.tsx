import type { ReactNode } from "react";
import {
  componentCatalogNamesFromReport,
  governanceTabCounts,
  unusedComponentsFromReport,
} from "../dashboard/aggregate";
import { DashboardBody } from "../dashboard/DashboardBody";
import type { DslinterReportState } from "../dashboard/useWorkspaceReport";

type Props = {
  /** Intro / landing copy shown above the governance inventory. */
  landing?: ReactNode;
  reportUrl?: string;
  dslinterReportHint?: string;
  dslinterReport: DslinterReportState;
  onOpenComponent?: (name: string) => void;
  onOpenCatalog?: () => void;
};

export function GovernancePane({
  landing,
  reportUrl: _reportUrl = "/dslinter-report.json",
  dslinterReportHint = "npm run dslinter:report",
  dslinterReport,
  onOpenComponent,
  onOpenCatalog,
}: Props) {
  const { report, error, loading } = dslinterReport;
  const componentCatalogCount = report
    ? componentCatalogNamesFromReport(report).length
    : 0;
  const unusedCount = report ? unusedComponentsFromReport(report).length : 0;
  const findingCount = report ? governanceTabCounts(report).all : 0;

  if (error) {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-muted/40">
        {landing}
        <header className="border-b border-border bg-card px-8 py-6">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Governance
          </h1>
        </header>
        <div className="mx-auto max-w-lg px-8 py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            Could not load DSLinter report
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{error}</p>
          <p className="mt-6 text-xs text-muted-foreground">
            Regenerate the JSON, then refresh. Example:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {dslinterReportHint}
            </code>
          </p>
        </div>
      </div>
    );
  }

  if (loading || !report) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-muted/40">
        {landing}
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading inventory…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-muted/40">
      {landing}
      <header className="border-b border-border bg-card px-8 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Inventory
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          Governance
          <span className="font-normal text-muted-foreground">
            {" "}
            · {findingCount} {findingCount === 1 ? "issue" : "issues"} ·{" "}
            {unusedCount} unused · {componentCatalogCount} total
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Governance scores, workspace findings, and components with no usage
          from the latest DSLinter snapshot
        </p>
      </header>
      <div className="min-w-0 w-full px-6 py-8">
        <DashboardBody
          report={report}
          onOpenComponent={onOpenComponent}
          onOpenCatalog={onOpenCatalog}
        />
      </div>
    </div>
  );
}
