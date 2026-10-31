import Explorer from "../src/explorer/Explorer";
import { DashboardThemeProvider } from "../src/shell/DashboardLayout";

export default function App() {
  return (
    <DashboardThemeProvider>
      <Explorer />
    </DashboardThemeProvider>
  );
}
