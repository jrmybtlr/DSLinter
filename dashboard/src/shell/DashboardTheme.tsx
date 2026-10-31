import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
    /** Migrate legacy `system` (and any unknown) — OS preference is ignored. */
    if (v != null) {
      localStorage.setItem(STORAGE_KEY, "light");
      return "light";
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

const DashboardThemeContext = createContext<DashboardThemeContextValue | null>(null);

export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DashboardThemePreference>(() => readInitialTheme());

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

  const value = useMemo(() => ({ theme, setTheme, resolvedTheme: theme }), [theme, setTheme]);

  return <DashboardThemeContext.Provider value={value}>{children}</DashboardThemeContext.Provider>;
}

export function useDashboardTheme(): DashboardThemeContextValue {
  const ctx = useContext(DashboardThemeContext);
  if (!ctx) {
    throw new Error("useDashboardTheme must be used within DashboardThemeProvider");
  }
  return ctx;
}
