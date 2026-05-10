import { useWorkspaceReport, WorkbenchLayout } from "@dslint/workbench";
import { DemoOverview } from "./DemoOverview";
import { playgroundEntries } from "./playground/buildRegistry";
import { tokenCatalog } from "./tokenCatalog";

// When running `npm run dev:serve` Vite proxies /events to the Rust server,
// so the SSE hot-reload path is available at the default /events URL.
const IS_SERVE_MODE = import.meta.env.MODE === "serve";

export default function App() {
  const dslintReport = useWorkspaceReport({
    reportUrl: "/dslint-report.json",
    // In serve mode subscribe to the SSE stream from `dslint --serve 7878`.
    watchUrl: IS_SERVE_MODE ? "/events" : undefined,
    // Fall back to 5-second polling when not in serve mode (so a manual
    // `npm run dslint:report` + page-save still updates automatically).
    refreshIntervalMs: IS_SERVE_MODE ? 0 : 5000,
  });

  return (
    <WorkbenchLayout
      playgroundEntries={playgroundEntries}
      tokenCatalog={tokenCatalog}
      dslintReport={dslintReport}
      overview={<DemoOverview />}
      dslintReportHint="npm run dslint:report (from demo/)"
      formatModulePath={(modulePath) => `demo/${modulePath.replace(/^\.\.\//, "")}`}
    />
  );
}
