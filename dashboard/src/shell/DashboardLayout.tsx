import type { ReactNode } from "react";
import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import type { PlaygroundEntry } from "../types/playground";
import type { TokenCatalog } from "../types/tokenCatalog";
import type { DslinterReportState } from "../dashboard/useWorkspaceReport";
import { ComponentInspectPane } from "../components/ComponentInspectPane";
import { ComponentPlaygroundPane } from "../components/ComponentPlaygroundPane";
import { CatalogPane } from "../components/CatalogPane";
import { GovernancePane } from "../components/GovernancePane";
import { Sidebar } from "../components/Sidebar";
import { TokensPane } from "../components/TokensPane";
import { DashboardCommandPalette } from "../components/DashboardCommandPalette";
import {
  componentCatalogNamesFromReport,
  componentCatalogTreeFromReport,
  resolveFamilyNavigationTarget,
} from "../dashboard/aggregate";
import { reportWithExtraHidden } from "../dashboard/catalogVisibility";
import { resolvePlaygroundEntry } from "../playground/buildPlaygroundEntriesFromReport";
import { findPlaygroundJoinSkip, type PlaygroundJoinSkip } from "../playground/playgroundJoin";
import { useHashRoute } from "./useHashRoute";

const DashboardLayoutAuto = lazy(() => import("./DashboardLayoutAuto"));

import { DashboardThemeProvider, useDashboardTheme } from "./DashboardTheme";
export { DashboardThemeProvider, useDashboardTheme } from "./DashboardTheme";
export type { DashboardThemePreference, DashboardResolvedTheme } from "./DashboardTheme";

export type DashboardLayoutProps = {
  /**
   * When true, loads playground modules from the dslinter Vite plugin
   * (`virtual:dslinter/playground-modules`). Requires `plugins: [dslinter()]`
   * from `dslinter/vite`, or running via `npx dslinter`.
   */
  autoPlayground?: boolean;
  /** Required unless `autoPlayground` is true. */
  playgroundEntries?: PlaygroundEntry[];
  /** Join failures from `buildPlaygroundEntriesFromReportWithSkips` — powers inspect-pane hints. */
  playgroundJoinSkips?: PlaygroundJoinSkip[];
  tokenCatalog?: TokenCatalog;
  /** Custom intro shown above the governance inventory on `/governance`; defaults to package copy. */
  overview?: ReactNode;
  /** Fetch URL for `dslint --json` output. */
  reportUrl?: string;
  /** Shown next to the governance refresh hint. */
  dslinterReportHint?: string;
  /** Workspace report fetch state (shared by governance + component a11y). */
  dslinterReport: DslinterReportState;
};

export type DashboardLayoutInnerProps = Omit<
  DashboardLayoutProps,
  "autoPlayground" | "playgroundEntries" | "playgroundJoinSkips"
> & {
  playgroundEntries: PlaygroundEntry[];
  playgroundJoinSkips?: PlaygroundJoinSkip[];
};

export function DashboardLayoutInner({
  playgroundEntries,
  playgroundJoinSkips,
  tokenCatalog,
  overview,
  reportUrl,
  dslinterReportHint,
  dslinterReport,
}: DashboardLayoutInnerProps) {
  const [route, navigate] = useHashRoute();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [optimisticHidden, setOptimisticHidden] = useState<string[]>([]);
  const { resolvedTheme } = useDashboardTheme();

  const catalogReport = useMemo(
    () => reportWithExtraHidden(dslinterReport.report, optimisticHidden),
    [dslinterReport.report, optimisticHidden],
  );

  const catalogNames = useMemo(
    () => componentCatalogNamesFromReport(catalogReport),
    [catalogReport],
  );
  const catalogEntries = useMemo(() => {
    const tree = componentCatalogTreeFromReport(catalogReport);
    return tree.flatMap((item) => {
      if (item.type === "component") {
        return [{ name: item.name, label: item.name }];
      }
      return [
        {
          name: resolveFamilyNavigationTarget(item, catalogNames),
          label: item.parent,
        },
        ...item.children.map((child) => ({
          name: child,
          label: `${item.parent} / ${child}`,
        })),
      ];
    });
  }, [catalogReport, catalogNames]);

  const handleHideFromCatalog = useCallback(
    (componentName: string) => {
      setOptimisticHidden((prev) =>
        prev.includes(componentName) ? prev : [...prev, componentName],
      );
      if (route.view === "component" && route.componentId === componentName) {
        navigate({ view: "governance" });
      }
    },
    [route, navigate],
  );

  const reportReady =
    !dslinterReport.loading && dslinterReport.error == null && dslinterReport.report != null;

  let main: ReactNode;
  if (route.view === "tokens") {
    main = <TokensPane tokenCatalog={tokenCatalog} dslinterReport={dslinterReport.report} />;
  } else if (route.view === "governance") {
    main = (
      <GovernancePane
        landing={overview}
        reportUrl={reportUrl}
        dslinterReportHint={dslinterReportHint}
        dslinterReport={dslinterReport}
        onOpenComponent={(name) => navigate({ view: "component", componentId: name })}
        onOpenCatalog={() => navigate({ view: "catalog" })}
      />
    );
  } else if (route.view === "catalog") {
    main = (
      <CatalogPane
        landing={overview}
        dslinterReportHint={dslinterReportHint}
        dslinterReport={dslinterReport}
        onOpenComponent={(name) => navigate({ view: "component", componentId: name })}
      />
    );
  } else if (route.view === "component") {
    const componentId = route.componentId;
    const entry = resolvePlaygroundEntry(playgroundEntries, componentId);
    const inCatalog = catalogNames.includes(componentId);
    const hasPlaygroundSpec =
      dslinterReport.report?.playgrounds?.some(
        (p) => p.export_name === componentId || p.id === componentId,
      ) ?? false;

    if (entry) {
      main = (
        <ComponentPlaygroundPane
          entry={entry}
          workspaceReport={dslinterReport.report}
          reportReady={reportReady}
          onHideFromCatalog={handleHideFromCatalog}
        />
      );
    } else if (inCatalog) {
      main = (
        <ComponentInspectPane
          componentId={componentId}
          workspaceReport={dslinterReport.report}
          reportReady={reportReady}
          hasPlaygroundSpec={hasPlaygroundSpec}
          playgroundJoinSkip={findPlaygroundJoinSkip(playgroundJoinSkips, componentId)}
          onOpenComponent={(name) => navigate({ view: "component", componentId: name })}
          onHideFromCatalog={handleHideFromCatalog}
        />
      );
    } else {
      main = (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-muted/40 px-8 text-center">
          <p className="text-sm font-medium text-foreground">Unknown component</p>
          <p className="max-w-md text-xs text-muted-foreground">
            <span className="font-mono">{componentId}</span> is not in the latest scan catalog.
          </p>
        </div>
      );
    }
  }

  return (
    <div
      data-dashboard-theme={resolvedTheme}
      className="flex h-screen min-h-0 bg-background text-foreground"
    >
      <DashboardCommandPalette
        catalogEntries={catalogEntries}
        onNavigate={navigate}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
      <Sidebar
        report={catalogReport ?? null}
        reportLoading={dslinterReport.loading}
        reportError={dslinterReport.error}
        route={route}
        onNavigate={navigate}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        catalogNames={catalogNames}
      />
      <div className="ml-[240px] flex min-h-0 min-w-0 flex-1 flex-col">{main}</div>
    </div>
  );
}

export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <DashboardThemeProvider>
      {props.autoPlayground ? (
        <Suspense fallback={null}>
          <DashboardLayoutAuto {...props} />
        </Suspense>
      ) : (
        <DashboardLayoutInner
          {...props}
          playgroundEntries={props.playgroundEntries ?? []}
          playgroundJoinSkips={props.playgroundJoinSkips}
        />
      )}
    </DashboardThemeProvider>
  );
}
