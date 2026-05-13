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
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Ownership
            </h2>
            <p className="text-xs text-neutral-500">
              Prefix match from <span className="font-mono">.dslint.json</span>{" "}
              — useful for adoption rollups.
            </p>
          </div>
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
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              Components
            </h2>
            <p className="text-xs text-neutral-500">
              Definitions and JSX usage from the latest snapshot.
            </p>
          </div>
          <span className="text-xs text-neutral-400">
            {report.files.length} files scanned
          </span>
        </div>
        <ComponentCatalog report={report} />
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Issues</h2>
          </div>
          <span className="text-xs text-neutral-400">
            {report.findings.length} total
          </span>
        </div>
        <FindingsList findings={report.findings} root={report.root} />
      </section>
    </div>
  );
}
