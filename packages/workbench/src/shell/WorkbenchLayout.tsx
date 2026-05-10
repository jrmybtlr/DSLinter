import type { ReactNode } from "react";
import type { PlaygroundEntry } from "../types/playground";
import type { TokenCatalog } from "../types/tokenCatalog";
import type { DslintReportState } from "../dashboard/useWorkspaceReport";
import { ComponentPlaygroundPane } from "./ComponentPlaygroundPane";
import { DefaultOverview } from "./DefaultOverview";
import { GovernancePane } from "./GovernancePane";
import { Sidebar } from "./Sidebar";
import { TokensPane } from "./TokensPane";
import { useHashRoute } from "./useHashRoute";

export type WorkbenchLayoutProps = {
  playgroundEntries: PlaygroundEntry[];
  tokenCatalog: TokenCatalog;
  /** Custom overview main area; defaults to package copy. */
  overview?: ReactNode;
  /** Fetch URL for `dslint --json` output. */
  reportUrl?: string;
  /** Shown next to the governance refresh hint. */
  dslintReportHint?: string;
  /** Maps Vite `import.meta.glob` path to a label in the component header. */
  formatModulePath?: (modulePath: string) => string;
  /** DSLint JSON fetch state (shared by governance + component a11y). */
  dslintReport: DslintReportState;
};

export function WorkbenchLayout({
  playgroundEntries,
  tokenCatalog,
  overview,
  reportUrl,
  dslintReportHint,
  formatModulePath,
  dslintReport,
}: WorkbenchLayoutProps) {
  const [route, navigate] = useHashRoute();

  const getEntry = (id: string) => playgroundEntries.find((e) => e.id === id);

  let main: ReactNode;
  if (route.view === "overview") {
    main = overview ?? <DefaultOverview />;
  } else if (route.view === "tokens") {
    main = <TokensPane tokenCatalog={tokenCatalog} />;
  } else if (route.view === "governance") {
    main = (
      <GovernancePane
        tokenCatalog={tokenCatalog}
        reportUrl={reportUrl}
        dslintReportHint={dslintReportHint}
        dslintReport={dslintReport}
      />
    );
  } else {
    const entry = getEntry(route.componentId);
    if (!entry) {
      main = (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-slate-50 px-8 text-center">
          <p className="text-sm font-medium text-slate-900">Unknown preview</p>
          <p className="max-w-md text-xs text-slate-500">
            No playground registered for <span className="font-mono">{route.componentId}</span>.
          </p>
          <button
            type="button"
            onClick={() => navigate({ view: "overview" })}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Back to overview
          </button>
        </div>
      );
    } else {
      main = (
        <ComponentPlaygroundPane
          entry={entry}
          formatModulePath={formatModulePath}
          workspaceReport={dslintReport.report}
          reportReady={!dslintReport.loading && dslintReport.error == null && dslintReport.report != null}
        />
      );
    }
  }

  return (
    <div className="flex h-screen min-h-0 bg-white">
        <Sidebar entries={playgroundEntries} route={route} onNavigate={navigate} />
        <div className="min-h-0 min-w-0 flex-1 ml-[240px]">{main}</div>
    </div>
  );
}
