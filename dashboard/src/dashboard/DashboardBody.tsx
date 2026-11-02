import { useMemo, useState } from "react";
import { GovernanceInventoryFilter } from "../components/GovernanceInventoryFilter";
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
    description: "All findings from the latest workspace scan.",
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
    description: "Scanned components with no recorded references elsewhere in the workspace.",
  },
};

export function DashboardBody({
  report,
  onOpenComponent,
  componentLabels,
}: {
  report: WorkspaceReport;
  onOpenComponent?: (name: string) => void;
  componentLabels?: Record<string, { label: string; description?: string }>;
}) {
  const [tab, setTab] = useState<GovernanceInventoryTab>("all");

  const counts = useMemo(() => governanceTabCounts(report), [report]);
  const filteredFindings = useMemo(() => findingsForGovernanceTab(report, tab), [report, tab]);
  const unusedComponents = useMemo(() => unusedComponentsFromReport(report), [report]);
  const section = sectionMeta[tab];

  return (
    <div>
      <div>
        <ScoreStrip scores={report.scores} />
      </div>

      <div className="w-full min-w-0 space-y-6 px-6 py-6">
        {report.duplicate_components.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
            <span className="font-semibold">Duplicate component names: </span>
            {report.duplicate_components.map((d) => d.name).join(", ")}
          </div>
        ) : null}

        {tab === "unused" ? (
          <Section
            id={section.id}
            title={section.title}
            description={section.description}
            actions={<GovernanceInventoryFilter value={tab} onChange={setTab} counts={counts} />}
          >
            <UnusedComponentsList
              components={unusedComponents}
              root={report.root}
              onOpenComponent={onOpenComponent}
              componentLabels={componentLabels}
            />
          </Section>
        ) : (
          <section id={section.id} aria-labelledby={`${section.id}-heading`}>
            <FindingsList
              findings={filteredFindings}
              root={report.root}
              heading={{
                id: `${section.id}-heading`,
                title: section.title,
                description: section.description,
              }}
            >
              <GovernanceInventoryFilter value={tab} onChange={setTab} counts={counts} />
            </FindingsList>
          </section>
        )}
      </div>
    </div>
  );
}
