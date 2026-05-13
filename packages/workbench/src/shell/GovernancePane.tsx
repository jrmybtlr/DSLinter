import type { ReactNode } from "react";
import { DashboardBody } from "../dashboard/DashboardBody";
import type { DslintReportState } from "../dashboard/useWorkspaceReport";

type Props = {
  /** Intro / landing copy shown above the governance inventory. */
  landing?: ReactNode;
  reportUrl?: string;
  dslintReportHint?: string;
  dslintReport: DslintReportState;
};

export function GovernancePane({
  landing,
  reportUrl: _reportUrl = "/dslint-report.json",
  dslintReportHint = "npm run dslint:report",
  dslintReport,
}: Props) {
  const { report, error, loading } = dslintReport;

  if (error) {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-gray-50">
        {landing}
        <header className="border-b  bg-white px-8 py-6">
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">Governance</h1>
        </header>
        <div className="mx-auto max-w-lg px-8 py-16 text-center">
          <p className="text-sm font-medium text-gray-900">Could not load DSLint report</p>
          <p className="mt-2 text-xs text-gray-500">{error}</p>
          <p className="mt-6 text-xs text-gray-500">
            Regenerate the JSON, then refresh. Example:{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700">
              {dslintReportHint}
            </code>
          </p>
        </div>
      </div>
    );
  }

  if (loading || !report) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50">
        {landing}
        <div className="flex min-h-[12rem] flex-1 items-center justify-center text-sm text-gray-500">
          Loading inventory…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-gray-50">
      {landing}
      <header className="border-b bg-white px-8 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inventory</p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-gray-900">Governance</h1>
        <p className="text-sm text-gray-600">
          Scores, component catalog, token wall, and findings from the latest DSLint snapshot
        </p>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <DashboardBody report={report} />
      </div>
    </div>
  );
}
