import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import context from "virtual:dslinter/explorer";
import { useWorkspaceReport } from "../dashboard/useWorkspaceReport";
import { Sidebar } from "../components/Sidebar";
import { DashboardCommandPalette } from "../components/DashboardCommandPalette";
import { GovernancePane } from "../components/GovernancePane";
import { CatalogPane } from "../components/CatalogPane";
import { TokensPane } from "../components/TokensPane";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useDashboardTheme } from "../shell/DashboardTheme";
import { useHashRoute } from "../shell/useHashRoute";
import type { HashRoute } from "../shell/hashRoute";
import { catalogFromReport } from "./catalog";
import { catalogLabels, catalogNavigation, dashboardReport } from "./dashboardReport";
import { ExplorerComponent } from "./ExplorerComponent";

const hiddenKey = `dslinter-hidden:${context.root}`;
function readHidden(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(hiddenKey) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export default function Explorer() {
  const state = useWorkspaceReport({
    reportUrl: "/dslinter-report.json",
    watchUrl: "/events",
    refreshIntervalMs: 1000,
  });
  const [route, navigate] = useHashRoute();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [hidden, setHidden] = useState(readHidden);
  const [app, setApp] = useState(
    () =>
      new URLSearchParams(location.search).get("app") ||
      context.selectedApp ||
      context.apps[0]?.id ||
      "",
  );
  const { resolvedTheme } = useDashboardTheme();
  const catalog = useMemo(
    () =>
      state.report
        ? catalogFromReport(state.report).filter((component) => !hidden.includes(component.id))
        : [],
    [state.report, hidden],
  );
  const report = useMemo(
    () => (state.report ? dashboardReport(state.report, catalog) : null),
    [state.report, catalog],
  );
  const labels = useMemo(() => catalogLabels(catalog), [catalog]);
  const tree = useMemo(() => catalogNavigation(catalog), [catalog]);
  const names = useMemo(() => catalog.map((component) => component.id), [catalog]);
  const entries = useMemo(
    () =>
      catalog.map((component) => ({
        name: component.id,
        label: `${component.name} · ${component.preview.rel_path}`,
      })),
    [catalog],
  );
  const reportState = useMemo(() => ({ ...state, report }), [state, report]);

  useEffect(() => {
    try {
      localStorage.setItem(hiddenKey, JSON.stringify(hidden));
    } catch {
      /* Browser storage is optional. */
    }
  }, [hidden]);
  useEffect(() => {
    // Links copied from the first explorer used a canonical id directly in the fragment.
    if (!location.hash || !catalog.length) return;
    let reference: string;
    try {
      reference = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    const component = catalog.find((item) => item.id === reference);
    if (component) navigate({ view: "component", componentId: component.id });
  }, [catalog, navigate]);

  function chooseApp(value: string) {
    setApp(value);
    const url = new URL(location.href);
    url.searchParams.set("app", value);
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  function openComponent(componentId: string) {
    navigateView({ view: "component", componentId });
  }
  function hideComponent(id: string) {
    setHidden((previous) => [...new Set([...previous, id])]);
    navigateView({ view: "catalog" });
  }
  function navigateView(next: HashRoute) {
    // Keep the chosen application while navigating between the established dashboard routes.
    const query = location.search;
    navigate(next);
    if (query) history.replaceState(null, "", location.pathname + query + location.hash);
  }

  let main: ReactNode;
  if (route.view === "governance")
    main = (
      <GovernancePane
        dslinterReport={reportState}
        dslinterReportHint="npx dslinter --report"
        onOpenComponent={openComponent}
        onOpenCatalog={() => navigateView({ view: "catalog" })}
        componentLabels={labels}
      />
    );
  else if (route.view === "catalog")
    main = (
      <CatalogPane
        dslinterReport={reportState}
        dslinterReportHint="npx dslinter --report"
        onOpenComponent={openComponent}
        componentLabels={labels}
      />
    );
  else if (route.view === "tokens") main = <TokensPane dslinterReport={report} />;
  else if (!report)
    main = (
      <p role="status" className="p-8 text-sm text-muted-foreground">
        {state.error || "Scanning workspace…"}
      </p>
    );
  else {
    const reference = route.componentId;
    const exact = catalog.find((component) => component.id === reference);
    const matches = catalog.filter((component) => component.name === reference);
    const component = exact || (matches.length === 1 ? matches[0] : undefined);
    if (component) {
      main = (
        <ExplorerComponent
          key={`${component.id}:${app}`}
          component={component}
          catalog={catalog}
          report={report}
          app={app}
          onHide={hideComponent}
        />
      );
    } else if (matches.length > 1)
      main = (
        <div className="p-8">
          <h1 className="text-xl font-semibold">Choose which {reference} to preview</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Several components share this name. Select a source file below.
          </p>
          <div className="mt-6 flex flex-col items-start gap-3">
            {matches.map((component) => (
              <Button
                key={component.id}
                variant="outline"
                onClick={() => openComponent(component.id)}
              >
                {component.name} · {component.preview.rel_path}
              </Button>
            ))}
          </div>
        </div>
      );
    else
      main = (
        <div className="p-8">
          <h1 className="text-xl font-semibold">Component unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This component is not in the current scan. Choose another component from the sidebar, or
            refresh the scan if its source has changed.
          </p>
        </div>
      );
  }

  const picker =
    context.apps.length === 1 ? null : (
      <div className="shrink-0 border-b border-border px-3 py-3">
        <label
          htmlFor="preview-application"
          className="block px-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          Preview application
        </label>
        <Select
          value={app || undefined}
          onValueChange={chooseApp}
          disabled={context.apps.length === 0}
        >
          <SelectTrigger
            id="preview-application"
            aria-label="Preview application"
            className="mt-2 h-8 w-full px-2 text-xs font-normal shadow-none"
          >
            <SelectValue placeholder="No Vite app detected" />
          </SelectTrigger>
          <SelectContent>
            {context.apps.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id} className="text-xs">
                {candidate.name}
                <span className="text-muted-foreground"> · {candidate.framework}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  return (
    <div
      data-dashboard-theme={resolvedTheme}
      className="flex h-screen min-h-0 bg-background text-foreground"
    >
      <DashboardCommandPalette
        catalogEntries={entries}
        onNavigate={navigateView}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
      <Sidebar
        report={report}
        reportLoading={state.loading}
        reportError={state.error}
        route={route}
        onNavigate={navigateView}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        catalogNames={names}
        catalogTree={tree}
        catalogLabels={labels}
        contextPicker={picker}
        footer={
          hidden.length > 0 && (
            <button
              type="button"
              className="mb-3 w-full text-xs text-muted-foreground underline"
              onClick={() => setHidden([])}
            >
              Restore {hidden.length} hidden {hidden.length === 1 ? "component" : "components"}
            </button>
          )
        }
      />
      <main className="ml-[240px] flex min-h-0 min-w-0 flex-1 flex-col">{main}</main>
    </div>
  );
}
