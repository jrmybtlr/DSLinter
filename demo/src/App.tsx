import { useWorkspaceReport, WorkbenchLayout } from "@dslint/workbench";
import { DemoOverview } from "./DemoOverview";
import { playgroundEntries } from "./playground/buildRegistry";
import { tokenCatalog } from "./tokenCatalog";

export default function App() {
  const dslintReport = useWorkspaceReport();

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
