import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * v2 key: older builds wrote a concrete `light`/`dark` value on every load,
 * which was not an explicit choice. Using a new key lets existing installs
 * start following the browser preference.
 */
const STORAGE_KEY = "dslinter-dashboard-theme-preference";
const LEGACY_STORAGE_KEYS = ["dslinter-dashboard-theme", "dslinter-workbench-theme"];

const DARK_QUERY = "(prefers-color-scheme: dark)";

export type DashboardThemePreference = "light" | "dark" | "system";
export type DashboardResolvedTheme = "light" | "dark";

function isPreference(value: string | null): value is DashboardThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readStored(): DashboardThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isPreference(stored)) return stored;
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  return "system";
}

function readInitialTheme(): DashboardThemePreference {
  return readStored();
}

function readSystemTheme(): DashboardResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Resolve a stored preference against the current browser colour scheme. */
export function resolveDashboardTheme(
  preference: DashboardThemePreference,
  systemTheme: DashboardResolvedTheme,
): DashboardResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

type DashboardThemeContextValue = {
  theme: DashboardThemePreference;
  setTheme: (next: DashboardThemePreference) => void;
  /** The effective theme after resolving `system` against the browser preference. */
  resolvedTheme: DashboardResolvedTheme;
};

const DashboardThemeContext = createContext<DashboardThemeContextValue | null>(null);

export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<DashboardThemePreference>(() => readInitialTheme());
  const [systemTheme, setSystemTheme] = useState<DashboardResolvedTheme>(() => readSystemTheme());

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
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystemTheme(query.matches ? "dark" : "light");
    onChange();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || e.newValue == null) return;
      if (isPreference(e.newValue)) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const resolvedTheme = resolveDashboardTheme(theme, systemTheme);
  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme],
  );

  return <DashboardThemeContext.Provider value={value}>{children}</DashboardThemeContext.Provider>;
}

export function useDashboardTheme(): DashboardThemeContextValue {
  const ctx = useContext(DashboardThemeContext);
  if (!ctx) {
    throw new Error("useDashboardTheme must be used within DashboardThemeProvider");
  }
  return ctx;
}
