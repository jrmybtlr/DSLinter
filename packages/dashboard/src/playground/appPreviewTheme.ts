import type { CssTokenDefinition, CssTokenSummary, WorkspaceReport } from "../types/report";

const DASHBOARD_THEME_PATH_MARKERS = [
  "dashboard-theme.css",
  "dslinter/theme.css",
] as const;

export type AppPreviewTheme = {
  light: Record<string, string>;
  dark: Record<string, string>;
  sourcePaths: string[];
};

export function isDashboardThemePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return DASHBOARD_THEME_PATH_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
}

export function isConsumerThemeDefinition(
  def: CssTokenDefinition,
  reportRoot?: string,
): boolean {
  if (isDashboardThemePath(def.path)) return false;

  const normalizedPath = def.path.replace(/\\/g, "/");
  if (normalizedPath.includes("/packages/dashboard/")) return false;

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

  const vars = new Map<string, string>();
  for (const def of definitions) {
    if (!isConsumerThemeDefinition(def, reportRoot)) continue;
    if (!scopes.has(def.scope)) continue;
    if (!vars.has(def.name)) {
      vars.set(def.name, def.value);
    }
  }
  return vars;
}

function resolveCssVariables(vars: Map<string, string>): Record<string, string> {
  const resolved = new Map<string, string>();
  const varRefRe = /var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,[^)]+)?\s*\)/g;

  const resolveOne = (name: string, seen: Set<string>): string => {
    const cached = resolved.get(name);
    if (cached != null) return cached;

    const raw = vars.get(name);
    if (raw == null) return `var(${name})`;
    if (seen.has(name)) return raw;

    seen.add(name);
    const next = raw.replace(varRefRe, (_match, ref: string) => {
      if (!vars.has(ref)) return `var(${ref})`;
      return resolveOne(ref, seen);
    });
    seen.delete(name);
    resolved.set(name, next);
    return next;
  };

  for (const name of vars.keys()) {
    resolveOne(name, new Set());
  }

  return Object.fromEntries(resolved);
}

export function buildAppPreviewTheme(
  summary: CssTokenSummary | null | undefined,
  reportRoot?: string,
): AppPreviewTheme | null {
  const definitions = summary?.definitions;
  if (!definitions?.length) return null;

  const light = resolveCssVariables(
    definitionsForMode(definitions, "light", reportRoot),
  );
  const dark = resolveCssVariables(
    definitionsForMode(definitions, "dark", reportRoot),
  );

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
