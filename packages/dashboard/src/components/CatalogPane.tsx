import type { ReactNode } from "react";
import { componentCatalogNamesFromReport } from "../dashboard/aggregate";
import { ComponentCatalog } from "../dashboard/ComponentCatalog";
import type { DslinterReportState } from "../dashboard/useWorkspaceReport";

type Props = {
  dslinterReport: DslinterReportState;
  dslinterReportHint?: string;
  onOpenComponent?: (name: string) => void;
  onBackToGovernance?: () => void;
  landing?: ReactNode;
};

export function CatalogPane({
  dslinterReport,
  dslinterReportHint = "npm run dslinter:report",
  onOpenComponent,
  onBackToGovernance,
  landing,
}: Props) {
  const { report, error, loading } = dslinterReport;
  const componentCount = report
    ? componentCatalogNamesFromReport(report).length
    : 0;

  if (error) {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-muted/40">
        {landing}
        <header className="border-b border-border bg-card px-8 py-6">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            All components
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
          Loading component catalog…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-muted/40">
      {landing}
      <header className="border-b border-border bg-card px-8 py-6">
        {onBackToGovernance ? (
          <button
            type="button"
            onClick={onBackToGovernance}
            className="mb-2 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            ← Governance
          </button>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Inventory
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          All components
          <span className="font-normal text-muted-foreground">
            {" "}
            · {componentCount} components
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Full catalog with prop usage and app references from the latest scan.
        </p>
      </header>
      <div className="min-w-0 w-full px-6 py-8">
        <ComponentCatalog report={report} onOpenComponent={onOpenComponent} />
      </div>
    </div>
  );
}
