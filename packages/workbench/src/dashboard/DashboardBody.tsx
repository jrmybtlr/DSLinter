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
            <h2 className="text-sm font-semibold text-neutral-900">Ownership</h2>
            <p className="text-xs text-neutral-500">
              Prefix match from <span className="font-mono">.dslint.json</span> — useful for
              adoption rollups.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table className="min-w-full text-left text-xs">
              <TableHeader>
                <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                  <TableHead className="h-auto px-3 py-2 text-muted-foreground">Owner</TableHead>
                  <TableHead className="h-auto px-3 py-2 text-muted-foreground">Files</TableHead>
                  <TableHead className="h-auto px-3 py-2 text-muted-foreground">Definitions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-foreground">
                {report.ownership.map((row) => (
                  <TableRow key={row.owner} className="border-border hover:bg-transparent">
                    <TableCell className="px-3 py-2 font-medium">{row.owner}</TableCell>
                    <TableCell className="px-3 py-2 tabular-nums">{row.files}</TableCell>
                    <TableCell className="px-3 py-2 tabular-nums">{row.definitions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Components</h2>
            <p className="text-xs text-neutral-500">
              Definitions and JSX usage from the latest snapshot.
            </p>
          </div>
          <span className="text-xs text-neutral-400">{report.files.length} files scanned</span>
        </div>
        <ComponentCatalog report={report} />
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Governance signals</h2>
            <p className="text-xs text-neutral-500">
              Accessibility (`a11y-*`) and code-quality heuristics (`smell-*` rule ids) from the
              latest DSLint run.
            </p>
          </div>
          <span className="text-xs text-neutral-400">{report.findings.length} total</span>
        </div>
        <FindingsList findings={report.findings} root={report.root} />
      </section>
    </div>
  );
}
