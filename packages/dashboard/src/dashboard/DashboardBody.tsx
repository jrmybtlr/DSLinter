import { useMemo, useState } from "react";
import { GovernanceInventoryTabs } from "../components/GovernanceInventoryTabs";
import { Section } from "../components/Section";
import type { WorkspaceReport } from "../types/report";
import {
  findingsForGovernanceTab,
  governanceTabCounts,
  type GovernanceInventoryTab,
  unusedComponentsFromReport,
} from "./aggregate";
import { FindingsList } from "./FindingsList";
import { ScoreStrip } from "./ScoreStrip";
import { UnusedComponentsList } from "./UnusedComponentsList";

const sectionMeta: Record<
  GovernanceInventoryTab,
  { id: string; title: string; description: string }
> = {
  all: {
    id: "issues",
    title: "Issues",
    description: "All findings from the workspace DSLinter report.",
  },
  a11y: {
    id: "accessibility-issues",
    title: "Accessibility issues",
    description: "Findings from accessibility rules in the latest snapshot.",
  },
  code: {
    id: "code-issues",
    title: "Code quality issues",
    description: "Findings from code quality rules in the latest snapshot.",
  },
  token: {
    id: "token-issues",
    title: "Token issues",
    description: "Findings from design token rules in the latest snapshot.",
  },
  unused: {
    id: "unused-components",
    title: "Unused components",
    description:
      "Scanned definitions with no JSX references elsewhere in the workspace.",
  },
};

export function DashboardBody({
  report,
  onOpenComponent,
  onOpenCatalog,
}: {
  report: WorkspaceReport;
  onOpenComponent?: (name: string) => void;
  onOpenCatalog?: () => void;
}) {
  const [tab, setTab] = useState<GovernanceInventoryTab>("all");

  const counts = useMemo(() => governanceTabCounts(report), [report]);
  const filteredFindings = useMemo(
    () => findingsForGovernanceTab(report, tab),
    [report, tab],
  );
  const unusedComponents = useMemo(
    () => unusedComponentsFromReport(report),
    [report],
  );
  const section = sectionMeta[tab];

  return (
    <div className="space-y-10">
      <ScoreStrip scores={report.scores} />

      {report.duplicate_components.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          <span className="font-semibold">Duplicate component names: </span>
          {report.duplicate_components.map((d) => d.name).join(", ")}
        </div>
      ) : null}

      <GovernanceInventoryTabs value={tab} onChange={setTab} counts={counts} />

      <Section id={section.id}>
        {tab === "unused" ? (
          <UnusedComponentsList
            components={unusedComponents}
            root={report.root}
            onOpenComponent={onOpenComponent}
          />
        ) : (
          <FindingsList findings={filteredFindings} root={report.root} />
        )}
      </Section>

      {onOpenCatalog ? (
        <p className="text-sm text-muted-foreground">
          <button
            type="button"
            onClick={onOpenCatalog}
            className="font-medium text-foreground underline decoration-dotted underline-offset-2 transition hover:decoration-solid"
          >
            View all components
          </button>{" "}
          for prop usage and app reference details.
        </p>
      ) : null}
    </div>
  );
}
