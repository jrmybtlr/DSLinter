import type { DashboardLayoutProps } from "./DashboardLayout";
import { usePlaygroundFromReport } from "../playground/usePlaygroundFromReport";
import { DashboardLayoutInner } from "./DashboardLayout";

/** Loaded via `React.lazy` when `autoPlayground` is set (pulls virtual playground modules). */
export default function DashboardLayoutAuto(props: DashboardLayoutProps) {
  const autoPlaygroundBuild = usePlaygroundFromReport(props.dslinterReport.report);

  return (
    <DashboardLayoutInner
      {...props}
      playgroundEntries={autoPlaygroundBuild.entries}
      playgroundJoinSkips={autoPlaygroundBuild.skipped}
    />
  );
}
