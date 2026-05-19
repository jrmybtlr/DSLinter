import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PlaygroundEntry } from "../types/playground";
import type { TokenCatalog } from "../types/tokenCatalog";
import type { DslinterReportState } from "../dashboard/useWorkspaceReport";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { ComponentInspectPane } from "../components/ComponentInspectPane";
import { ComponentPlaygroundPane } from "../components/ComponentPlaygroundPane";
import { GovernancePane } from "../components/GovernancePane";
import { Sidebar } from "../components/Sidebar";
import { TokensPane } from "../components/TokensPane";
import { DashboardCommandPalette } from "../components/DashboardCommandPalette";
import { componentCatalogNamesFromReport } from "../dashboard/aggregate";
import { resolvePlaygroundEntry } from "../playground/buildPlaygroundEntriesFromReport";
import {
  findPlaygroundJoinSkip,
  type PlaygroundJoinSkip,
} from "../playground/playgroundJoin";
import { usePlaygroundFromReport } from "../playground/usePlaygroundFromReport";
import { useHashRoute } from "./useHashRoute";

const STORAGE_KEY = "dslinter-dashboard-theme";

export type DashboardThemePreference = "light" | "dark";
export type DashboardResolvedTheme = DashboardThemePreference;

function readStored(): DashboardThemePreference | null {
  if (typeof window === "undefined") return null;
  try {
    const LEGACY_KEY = "dslinter-workbench-theme";
    let v = localStorage.getItem(STORAGE_KEY);
    if (v == null) {
      v = localStorage.getItem(LEGACY_KEY);
      if (v === "light" || v === "dark") {
        localStorage.setItem(STORAGE_KEY, v);
        localStorage.removeItem(LEGACY_KEY);
      }
    }
    if (v === "light" || v === "dark") return v;
    /** Migrate legacy `system` (and any unknown) to an explicit mode. */
    if (v === "system") {
      const next = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readInitialTheme(): DashboardThemePreference {
  return readStored() ?? "light";
}

type DashboardThemeContextValue = {
  theme: DashboardThemePreference;
  setTheme: (next: DashboardThemePreference) => void;
  /** Same as `theme`; kept for callers that already used `resolvedTheme`. */
  resolvedTheme: DashboardResolvedTheme;
};

const DashboardThemeContext = createContext<DashboardThemeContextValue | null>(
  null,
);

export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DashboardThemePreference>(() =>
    readInitialTheme(),
  );

  const setTheme = useCallback((next: DashboardThemePreference) => {
    setThemeState(next);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      if (e.newValue === "light" || e.newValue === "dark") {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme: theme }),
    [theme, setTheme],
  );

  return (
    <DashboardThemeContext.Provider value={value}>
      {children}
    </DashboardThemeContext.Provider>
  );
}

export function useDashboardTheme(): DashboardThemeContextValue {
  const ctx = useContext(DashboardThemeContext);
  if (!ctx) {
    throw new Error(
      "useDashboardTheme must be used within DashboardThemeProvider",
    );
  }
  return ctx;
}

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
  /** Custom intro shown above the governance inventory on `#!/governance`; defaults to package copy. */
  overview?: ReactNode;
  /** Fetch URL for `dslint --json` output. */
  reportUrl?: string;
  /** Shown next to the governance refresh hint. */
  dslinterReportHint?: string;
  /** Maps Vite `import.meta.glob` path to a label in the component header. */
  formatModulePath?: (modulePath: string) => string;
  /** Workspace report fetch state (shared by governance + component a11y). */
  dslinterReport: DslinterReportState;
};

function DashboardLayoutInner({
  autoPlayground = false,
  playgroundEntries: playgroundEntriesProp,
  playgroundJoinSkips: playgroundJoinSkipsProp,
  tokenCatalog,
  overview,
  reportUrl,
  dslinterReportHint,
  formatModulePath,
  dslinterReport,
}: DashboardLayoutProps) {
  const autoPlaygroundBuild = usePlaygroundFromReport(
    autoPlayground ? dslinterReport.report : null,
  );
  const playgroundEntries = autoPlayground
    ? autoPlaygroundBuild.entries
    : (playgroundEntriesProp ?? []);
  const playgroundJoinSkips = autoPlayground
    ? autoPlaygroundBuild.skipped
    : playgroundJoinSkipsProp;
  const resolvedFormatModulePath =
    formatModulePath ??
    (autoPlayground
      ? (modulePath: string) => modulePath.replace(/^@dslint-scan\//, "")
      : undefined);

  const [route, navigate] = useHashRoute();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useDashboardTheme();

  const catalogNames = useMemo(
    () => componentCatalogNamesFromReport(dslinterReport.report),
    [dslinterReport.report],
  );

  const reportReady =
    !dslinterReport.loading &&
    dslinterReport.error == null &&
    dslinterReport.report != null;

  let main: ReactNode;
  if (route.view === "tokens") {
    main = (
      <TokensPane
        tokenCatalog={tokenCatalog}
        dslinterReport={dslinterReport.report}
      />
    );
  } else if (route.view === "governance") {
    main = (
      <GovernancePane
        landing={overview}
        reportUrl={reportUrl}
        dslinterReportHint={dslinterReportHint}
        dslinterReport={dslinterReport}
        onOpenComponent={(name) =>
          navigate({ view: "component", componentId: name })
        }
      />
    );
  } else {
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
          formatModulePath={resolvedFormatModulePath}
          workspaceReport={dslinterReport.report}
          reportReady={reportReady}
        />
      );
    } else if (inCatalog) {
      main = (
        <ComponentInspectPane
          componentId={componentId}
          workspaceReport={dslinterReport.report}
          reportReady={reportReady}
          hasPlaygroundSpec={hasPlaygroundSpec}
          playgroundJoinSkip={findPlaygroundJoinSkip(
            playgroundJoinSkips,
            componentId,
          )}
          onBackToGovernance={() => navigate({ view: "governance" })}
        />
      );
    } else {
      main = (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-muted/40 px-8 text-center">
          <p className="text-sm font-medium text-foreground">Unknown component</p>
          <p className="max-w-md text-xs text-muted-foreground">
            <span className="font-mono">{componentId}</span> is not in the
            latest scan catalog.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => navigate({ view: "governance" })}
          >
            Back to governance
          </Button>
        </div>
      );
    }
  }

  return (
    <div
      className={cn(
        "flex h-screen min-h-0 bg-background text-foreground",
        resolvedTheme === "dark" && "dark",
      )}
    >
      <DashboardCommandPalette
        catalogNames={catalogNames}
        onNavigate={navigate}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
      <Sidebar
        report={dslinterReport.report}
        reportLoading={dslinterReport.loading}
        reportError={dslinterReport.error}
        route={route}
        onNavigate={navigate}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        theme={theme}
        onThemeChange={setTheme}
      />
      <div className="ml-[240px] flex min-h-0 min-w-0 flex-1 flex-col">
        {main}
      </div>
    </div>
  );
}

export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <DashboardThemeProvider>
      <DashboardLayoutInner {...props} />
    </DashboardThemeProvider>
  );
}
