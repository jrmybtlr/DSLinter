import { DashboardBody } from "../dashboard/DashboardBody";
import type { DslintReportState } from "../dashboard/useWorkspaceReport";

type Props = {
  reportUrl?: string;
  dslintReportHint?: string;
  dslintReport: DslintReportState;
};

export function GovernancePane({
  reportUrl = "/dslint-report.json",
  dslintReportHint = "npm run dslint:report",
  dslintReport,
}: Props) {
  const { report, error, loading } = dslintReport;

  if (error) {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-6">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Governance</h1>
        </header>
        <div className="mx-auto max-w-lg px-8 py-16 text-center">
          <p className="text-sm font-medium text-slate-900">Could not load DSLint report</p>
          <p className="mt-2 text-xs text-slate-500">{error}</p>
          <p className="mt-6 text-xs text-slate-500">
            Regenerate the JSON, then refresh. Example:{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">{dslintReportHint}</code>
          </p>
        </div>
      </div>
    );
  }

  if (loading || !report) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading inventory…
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-8 py-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Inventory</p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Governance</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Scores, component catalog, token wall, and findings from the latest DSLint snapshot (
          <span className="font-mono text-xs">{reportUrl}</span>).
        </p>
        <p className="mt-2 font-mono text-[11px] text-slate-400">Root: {report.root}</p>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <DashboardBody report={report} />
      </div>
    </div>
  );
}
