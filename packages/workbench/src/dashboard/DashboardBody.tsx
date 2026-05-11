import type { WorkspaceReport } from "../types/report";
import { ComponentCatalog } from "./ComponentCatalog";
import { FindingsList } from "./FindingsList";
import { ScoreStrip } from "./ScoreStrip";

export function DashboardBody({
  report,
}: {
  report: WorkspaceReport;
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

      {report.ownership.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Ownership</h2>
            <p className="text-xs text-neutral-500">
              Prefix match from <span className="font-mono">.dslint.json</span> — useful for adoption rollups.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="min-w-full divide-y divide-neutral-100 text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Files</th>
                  <th className="px-3 py-2 font-medium">Definitions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {report.ownership.map((row) => (
                  <tr key={row.owner}>
                    <td className="px-3 py-2 font-medium">{row.owner}</td>
                    <td className="px-3 py-2 tabular-nums">{row.files}</td>
                    <td className="px-3 py-2 tabular-nums">{row.definitions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Components</h2>
            <p className="text-xs text-neutral-500">Definitions and JSX usage from the latest snapshot.</p>
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
              Accessibility (`a11y-*`) and code smell (`smell-*`) rules from the latest DSLint run.
            </p>
          </div>
          <span className="text-xs text-neutral-400">{report.findings.length} total</span>
        </div>
        <FindingsList findings={report.findings} root={report.root} />
      </section>
    </div>
  );
}
