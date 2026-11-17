import { createContext, useContext } from "react";
import { useDashboardTheme, type DashboardResolvedTheme } from "./DashboardTheme";

/** Overrides the dashboard theme for the live preview section only. */
export const PreviewSectionThemeContext = createContext<DashboardResolvedTheme | null>(null);

export function usePreviewSectionTheme(): DashboardResolvedTheme {
  const override = useContext(PreviewSectionThemeContext);
  const { resolvedTheme } = useDashboardTheme();
  return override ?? resolvedTheme;
}
