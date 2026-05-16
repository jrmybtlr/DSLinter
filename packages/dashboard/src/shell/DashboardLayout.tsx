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
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { ComponentPlaygroundPane } from "./ComponentPlaygroundPane";
import { GovernancePane } from "./GovernancePane";
import { Sidebar } from "./Sidebar";
import { TokensPane } from "./TokensPane";
import { DashboardCommandPalette } from "./DashboardCommandPalette";
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
  playgroundEntries: PlaygroundEntry[];
  tokenCatalog: TokenCatalog;
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
  playgroundEntries,
  tokenCatalog,
  overview,
  reportUrl,
  dslinterReportHint,
  formatModulePath,
  dslinterReport,
}: DashboardLayoutProps) {
  const [route, navigate] = useHashRoute();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useDashboardTheme();

  const getEntry = (id: string) => playgroundEntries.find((e) => e.id === id);

  let main: ReactNode;
  if (route.view === "tokens") {
    main = <TokensPane tokenCatalog={tokenCatalog} />;
  } else if (route.view === "governance") {
    main = (
      <GovernancePane
        landing={overview}
        reportUrl={reportUrl}
        dslinterReportHint={dslinterReportHint}
        dslinterReport={dslinterReport}
      />
    );
  } else {
    const entry = getEntry(route.componentId);
    if (!entry) {
      main = (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-muted/40 px-8 text-center">
          <p className="text-sm font-medium text-foreground">Unknown preview</p>
          <p className="max-w-md text-xs text-muted-foreground">
            No playground registered for{" "}
            <span className="font-mono">{route.componentId}</span>.
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
    } else {
      main = (
        <ComponentPlaygroundPane
          entry={entry}
          formatModulePath={formatModulePath}
          workspaceReport={dslinterReport.report}
          reportReady={
            !dslinterReport.loading &&
            dslinterReport.error == null &&
            dslinterReport.report != null
          }
        />
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
        entries={playgroundEntries}
        onNavigate={navigate}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
      <Sidebar
        entries={playgroundEntries}
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
