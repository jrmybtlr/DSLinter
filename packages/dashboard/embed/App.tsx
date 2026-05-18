import { DashboardLayout, useWorkspaceReport } from "../src/index";
import { tokenCatalog } from "./tokenCatalog";

export default function App() {
  const dslinterReport = useWorkspaceReport({
    reportUrl: "/dslint-report.json",
    watchUrl: "/events",
    refreshIntervalMs: 0,
  });

  return (
    <DashboardLayout
      playgroundEntries={[]}
      tokenCatalog={tokenCatalog}
      dslinterReport={dslinterReport}
      dslinterReportHint="dslinter (watch + serve)"
    />
  );
}
