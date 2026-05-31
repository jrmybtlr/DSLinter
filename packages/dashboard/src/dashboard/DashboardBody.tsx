import { Section } from "../components/Section";
import type { WorkspaceReport } from "../types/report";
import { ComponentCatalog } from "./ComponentCatalog";
import { FindingsList } from "./FindingsList";
import { ScoreStrip } from "./ScoreStrip";

export function DashboardBody({
  report,
  onOpenComponent,
}: {
  report: WorkspaceReport;
  onOpenComponent?: (name: string) => void;
}) {
  return (
    <div className="space-y-10">
      <ScoreStrip scores={report.scores} />

      {report.duplicate_components.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          <span className="font-semibold">Duplicate component names: </span>
          {report.duplicate_components.map((d) => d.name).join(", ")}
        </div>
      ) : null}

      <Section
        id="components"
        title="Components"
        description="Definitions and JSX usage from the latest snapshot."
      >
        <ComponentCatalog report={report} onOpenComponent={onOpenComponent} />
      </Section>

      <Section
        id="issues"
        title="Issues"
        description="Findings from the workspace DSLinter report scoped to this file."
      >
        <FindingsList findings={report.findings} root={report.root} />
      </Section>
    </div>
  );
}
