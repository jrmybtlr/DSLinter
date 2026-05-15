import { Section } from "../shell/Section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import type { WorkspaceReport } from "../types/report";
import { ComponentCatalog } from "./ComponentCatalog";
import { FindingsList } from "./FindingsList";
import { ScoreStrip } from "./ScoreStrip";

export function DashboardBody({ report }: { report: WorkspaceReport }) {
  return (
    <div className="space-y-10">
      <ScoreStrip scores={report.scores} />

      {report.duplicate_components.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
          <span className="font-semibold">Duplicate component names: </span>
          {report.duplicate_components.map((d) => d.name).join(", ")}
        </div>
      ) : null}

      {report.ownership.length > 0 ? (
        <Section
          id="ownership"
          title="Ownership"
          description="Prefix match from <span className='font-mono'>.dslint.json</span> — useful for adoption rollups."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Definitions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.ownership.map((row) => (
                <TableRow key={row.owner}>
                  <TableCell>{row.owner}</TableCell>
                  <TableCell>{row.files}</TableCell>
                  <TableCell>{row.definitions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      ) : null}

      <Section
        id="components"
        title="Components"
        description="Definitions and JSX usage from the latest snapshot."
      >
        <ComponentCatalog report={report} />
      </Section>

      <Section
        id="issues"
        title="Issues"
        description="Findings from the workspace dslint report scoped to this file."
      >
        <FindingsList findings={report.findings} root={report.root} />
      </Section>
    </div>
  );
}
