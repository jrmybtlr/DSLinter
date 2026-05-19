import { useMemo } from "react";
import {
  buildPlaygroundEntriesFromReport,
  DashboardLayout,
  useWorkspaceReport,
} from "../src/index";
import { scanPlaygroundModules } from "./playgroundModules";
import { tokenCatalog } from "./tokenCatalog";

export default function App() {
  const dslinterReport = useWorkspaceReport({
    reportUrl: "/dslint-report.json",
    watchUrl: "/events",
    refreshIntervalMs: 0,
  });

  const playgroundEntries = useMemo(
    () =>
      buildPlaygroundEntriesFromReport(
        dslinterReport.report,
        scanPlaygroundModules,
      ),
    [dslinterReport.report],
  );

  return (
    <DashboardLayout
      playgroundEntries={playgroundEntries}
      tokenCatalog={tokenCatalog}
      dslinterReport={dslinterReport}
      dslinterReportHint="dslinter (watch + serve)"
      formatModulePath={(modulePath) =>
        modulePath.replace(/^@dslint-scan\//, "")
      }
    />
  );
}
