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
import type { DslintReportState } from "../dashboard/useWorkspaceReport";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { ComponentPlaygroundPane } from "./ComponentPlaygroundPane";
import { GovernancePane } from "./GovernancePane";
import { Sidebar } from "./Sidebar";
import { TokensPane } from "./TokensPane";
import { WorkbenchCommandPalette } from "./WorkbenchCommandPalette";
import { useHashRoute } from "./useHashRoute";

const STORAGE_KEY = "dslint-workbench-theme";

export type WorkbenchThemePreference = "light" | "dark";
export type WorkbenchResolvedTheme = WorkbenchThemePreference;

function readStored(): WorkbenchThemePreference | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
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

function readInitialTheme(): WorkbenchThemePreference {
  return readStored() ?? "light";
}

type WorkbenchThemeContextValue = {
  theme: WorkbenchThemePreference;
  setTheme: (next: WorkbenchThemePreference) => void;
  /** Same as `theme`; kept for callers that already used `resolvedTheme`. */
  resolvedTheme: WorkbenchResolvedTheme;
};

const WorkbenchThemeContext = createContext<WorkbenchThemeContextValue | null>(
  null,
);

export function WorkbenchThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<WorkbenchThemePreference>(() =>
    readInitialTheme(),
  );

  const setTheme = useCallback((next: WorkbenchThemePreference) => {
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
    <WorkbenchThemeContext.Provider value={value}>
      {children}
    </WorkbenchThemeContext.Provider>
  );
}

export function useWorkbenchTheme(): WorkbenchThemeContextValue {
  const ctx = useContext(WorkbenchThemeContext);
  if (!ctx) {
    throw new Error("useWorkbenchTheme must be used within WorkbenchThemeProvider");
  }
  return ctx;
}

export type WorkbenchLayoutProps = {
  playgroundEntries: PlaygroundEntry[];
  tokenCatalog: TokenCatalog;
  /** Custom intro shown above the governance inventory on `#!/governance`; defaults to package copy. */
  overview?: ReactNode;
  /** Fetch URL for `dslint --json` output. */
  reportUrl?: string;
  /** Shown next to the governance refresh hint. */
  dslintReportHint?: string;
  /** Maps Vite `import.meta.glob` path to a label in the component header. */
  formatModulePath?: (modulePath: string) => string;
  /** DSLint JSON fetch state (shared by governance + component a11y). */
  dslintReport: DslintReportState;
};

function WorkbenchLayoutInner({
  playgroundEntries,
  tokenCatalog,
  overview,
  reportUrl,
  dslintReportHint,
  formatModulePath,
  dslintReport,
}: WorkbenchLayoutProps) {
  const [route, navigate] = useHashRoute();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useWorkbenchTheme();

  const getEntry = (id: string) => playgroundEntries.find((e) => e.id === id);

  let main: ReactNode;
  if (route.view === "tokens") {
    main = <TokensPane tokenCatalog={tokenCatalog} />;
  } else if (route.view === "governance") {
    main = (
      <GovernancePane
        landing={overview}
        reportUrl={reportUrl}
        dslintReportHint={dslintReportHint}
        dslintReport={dslintReport}
      />
    );
  } else {
    const entry = getEntry(route.componentId);
    if (!entry) {
      main = (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-muted/40 px-8 text-center">
          <p className="text-sm font-medium text-foreground">Unknown preview</p>
          <p className="max-w-md text-xs text-muted-foreground">
            No playground registered for <span className="font-mono">{route.componentId}</span>.
          </p>
          <Button type="button" size="sm" onClick={() => navigate({ view: "governance" })}>
            Back to governance
          </Button>
        </div>
      );
    } else {
      main = (
        <ComponentPlaygroundPane
          entry={entry}
          formatModulePath={formatModulePath}
          workspaceReport={dslintReport.report}
          reportReady={
            !dslintReport.loading && dslintReport.error == null && dslintReport.report != null
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
      <WorkbenchCommandPalette
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
      <div className="ml-[240px] flex min-h-0 min-w-0 flex-1 flex-col">{main}</div>
    </div>
  );
}

export function WorkbenchLayout(props: WorkbenchLayoutProps) {
  return (
    <WorkbenchThemeProvider>
      <WorkbenchLayoutInner {...props} />
    </WorkbenchThemeProvider>
  );
}
