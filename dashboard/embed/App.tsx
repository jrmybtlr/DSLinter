import {
  DashboardLayout,
  useWorkspaceReport,
} from "../src/index";
import { tokenCatalog } from "./tokenCatalog";

export default function App() {
  const dslinterReport = useWorkspaceReport({
    reportUrl: "/dslinter-report.json",
    watchUrl: "/events",
    refreshIntervalMs: 0,
  });

  return (
    <DashboardLayout
      autoPlayground
      tokenCatalog={tokenCatalog}
      dslinterReport={dslinterReport}
      dslinterReportHint="dslinter (watch + serve)"
    />
  );
}
