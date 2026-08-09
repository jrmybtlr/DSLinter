import { resolveCssVariables, variableMapForScopes } from "../css/resolveCssVariables";
import type { CssTokenDefinition, CssTokenSummary, WorkspaceReport } from "../types/report";

const DASHBOARD_THEME_PATH_MARKERS = ["dashboard-theme.css", "dslinter/theme.css"] as const;

export type AppPreviewTheme = {
  light: Record<string, string>;
  dark: Record<string, string>;
  sourcePaths: string[];
};

export function isDashboardThemePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return DASHBOARD_THEME_PATH_MARKERS.some((marker) => normalized.includes(marker));
}

export function isConsumerThemeDefinition(def: CssTokenDefinition, reportRoot?: string): boolean {
  if (isDashboardThemePath(def.path)) return false;

  const normalizedPath = def.path.replace(/\\/g, "/");
  if (normalizedPath.includes("/dashboard/")) return false;

  if (reportRoot) {
    const normalizedRoot = reportRoot.replace(/\\/g, "/").replace(/\/$/, "");
    if (normalizedPath.startsWith(normalizedRoot)) return true;
  }

  return /(?:^|\/)(resources\/css|src\/|app\/|styles\/)/.test(normalizedPath);
}

function definitionsForMode(
  definitions: CssTokenDefinition[],
  mode: "light" | "dark",
  reportRoot?: string,
): Map<string, string> {
  const scopes =
    mode === "light"
      ? new Set<CssTokenDefinition["scope"]>(["root", "theme"])
      : new Set<CssTokenDefinition["scope"]>(["selector"]);

  return variableMapForScopes(definitions, scopes, (def) =>
    isConsumerThemeDefinition(def, reportRoot),
  );
}

export function buildAppPreviewTheme(
  summary: CssTokenSummary | null | undefined,
  reportRoot?: string,
): AppPreviewTheme | null {
  const definitions = summary?.definitions;
  if (!definitions?.length) return null;

  const light = resolveCssVariables(definitionsForMode(definitions, "light", reportRoot));
  const dark = resolveCssVariables(definitionsForMode(definitions, "dark", reportRoot));

  const sourcePaths = [
    ...new Set(
      definitions
        .filter((def) => isConsumerThemeDefinition(def, reportRoot))
        .map((def) => def.path.replace(/\\/g, "/")),
    ),
  ].sort();

  const hasLightSemantic = Object.keys(light).some(
    (name) => !name.startsWith("--color-") && !name.startsWith("--spacing-"),
  );
  const hasDarkSemantic = Object.keys(dark).some(
    (name) => !name.startsWith("--color-") && !name.startsWith("--spacing-"),
  );

  if (!hasLightSemantic && !hasDarkSemantic) return null;

  return { light, dark, sourcePaths };
}

export function buildAppPreviewThemeFromReport(
  report: WorkspaceReport | null | undefined,
): AppPreviewTheme | null {
  if (!report?.css_tokens) return null;
  return buildAppPreviewTheme(report.css_tokens, report.root);
}

export function cssVariablesForPreviewTheme(
  theme: AppPreviewTheme,
  mode: "light" | "dark",
): Record<string, string> {
  if (mode === "dark" && Object.keys(theme.dark).length > 0) {
    return { ...theme.light, ...theme.dark };
  }
  return theme.light;
}
