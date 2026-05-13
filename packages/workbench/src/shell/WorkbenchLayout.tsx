import type { ReactNode } from "react";
import type { PlaygroundEntry } from "../types/playground";
import type { TokenCatalog } from "../types/tokenCatalog";
import type { DslintReportState } from "../dashboard/useWorkspaceReport";
import { ComponentPlaygroundPane } from "./ComponentPlaygroundPane";
import { GovernancePane } from "./GovernancePane";
import { Sidebar } from "./Sidebar";
import { TokensPane } from "./TokensPane";
import { useHashRoute } from "./useHashRoute";

export type WorkbenchLayoutProps = {
  playgroundEntries: PlaygroundEntry[];
  tokenCatalog: TokenCatalog;
  /** Custom intro shown above the governance inventory on `#!/governance`; defaults to package copy. */
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
  if (route.view === "tokens") {
    main = <TokensPane tokenCatalog={tokenCatalog} />;
  } else if (route.view === "governance") {
    main = (
      <GovernancePane
        landing={overview}
        reportUrl={reportUrl}
        dslintReportHint={dslintReportHint}
        dslintReport={dslintReport}
      />
    );
  } else {
    const entry = getEntry(route.componentId);
    if (!entry) {
      main = (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-gray-50 px-8 text-center">
          <p className="text-sm font-medium text-gray-900">Unknown preview</p>
          <p className="max-w-md text-xs text-gray-500">
            No playground registered for <span className="font-mono">{route.componentId}</span>.
          </p>
          <button
            type="button"
            onClick={() => navigate({ view: "governance" })}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
          >
            Back to governance
          </button>
        </div>
      );
    } else {
      main = (
        <ComponentPlaygroundPane
          entry={entry}
          formatModulePath={formatModulePath}
          workspaceReport={dslintReport.report}
          reportReady={
            !dslintReport.loading && dslintReport.error == null && dslintReport.report != null
          }
        />
      );
    }
  }

  return (
    <div className="flex h-screen min-h-0 bg-white">
      <Sidebar entries={playgroundEntries} route={route} onNavigate={navigate} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col ml-[240px]">{main}</div>
    </div>
  );
}
