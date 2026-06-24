import type { DashboardLayoutProps } from "./DashboardLayout";
import { usePlaygroundFromReport } from "../playground/usePlaygroundFromReport";
import { isStaticBundledPreviewUnavailable } from "../playground/playgroundJoin";
import { DashboardLayoutInner } from "./DashboardLayout";

function StaticPreviewUnavailableBanner() {
  return (
    <div
      className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm text-foreground"
      role="status"
    >
      Live component previews require the DSLinter embed dev server. Run{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
        npx dslinter
      </code>{" "}
      from your project root and open the <strong>Dashboard</strong> URL from the
      terminal banner (port 5175), not the scanner-only port. Upgrade to the
      latest <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">dslinter</code> if
      previews still fail.
    </div>
  );
}

/** Loaded via `React.lazy` when `autoPlayground` is set (pulls virtual playground modules). */
export default function DashboardLayoutAuto(props: DashboardLayoutProps) {
  const autoPlaygroundBuild = usePlaygroundFromReport(props.dslinterReport.report);
  const showStaticPreviewWarning = isStaticBundledPreviewUnavailable(
    autoPlaygroundBuild.skipped,
  );

  return (
    <>
      {showStaticPreviewWarning ? <StaticPreviewUnavailableBanner /> : null}
      <DashboardLayoutInner
        {...props}
        playgroundEntries={autoPlaygroundBuild.entries}
        playgroundJoinSkips={autoPlaygroundBuild.skipped}
      />
    </>
  );
}
