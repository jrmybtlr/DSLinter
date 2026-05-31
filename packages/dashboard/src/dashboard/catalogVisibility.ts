import type { WorkspaceReport } from "../types/report";

export type ReportConfig = NonNullable<WorkspaceReport["config"]>;

const BUILTIN_HIDDEN = new Set(["App", "React.StrictMode"]);

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function normalizePrefix(prefix: string): string {
  return prefix.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

export function pathMatchesPrefix(rel: string, prefix: string): boolean {
  const pre = normalizePrefix(prefix);
  if (!pre) return false;
  const r = normalizePath(rel);
  return r === pre || r.startsWith(`${pre}/`);
}

export function reportConfig(
  report: WorkspaceReport | null | undefined,
): ReportConfig {
  return report?.config ?? {};
}

export function hiddenComponentNames(
  report: WorkspaceReport | null | undefined,
  extraHidden?: Iterable<string>,
): Set<string> {
  const names = new Set(BUILTIN_HIDDEN);
  for (const n of reportConfig(report).hidden_components ?? []) {
    names.add(n);
  }
  if (extraHidden) {
    for (const n of extraHidden) names.add(n);
  }
  return names;
}

export function hiddenPathPrefixes(
  report: WorkspaceReport | null | undefined,
): string[] {
  return (reportConfig(report).hidden_paths ?? []).map(normalizePrefix).filter(Boolean);
}

/** True when the component should not appear in sidebar / palette / playground list. */
export function isCatalogComponentHidden(
  name: string,
  report: WorkspaceReport | null | undefined,
  definitionPaths: string[] | undefined,
  extraHidden?: Iterable<string>,
): boolean {
  if (hiddenComponentNames(report, extraHidden).has(name)) return true;
  const prefixes = hiddenPathPrefixes(report);
  if (!prefixes.length || !definitionPaths?.length) return false;
  for (const path of definitionPaths) {
    const rel = normalizePath(path);
    for (const pre of prefixes) {
      if (pathMatchesPrefix(rel, pre)) return true;
    }
  }
  return false;
}

export function definitionPathsForName(
  report: WorkspaceReport | null | undefined,
  name: string,
): string[] {
  if (!report) return [];
  const paths: string[] = [];
  for (const file of report.files ?? []) {
    for (const d of file.definitions ?? []) {
      if (d.name === name) paths.push(file.path);
    }
  }
  return paths;
}

/** Merge optimistic hides until the next report refresh includes them. */
export function reportWithExtraHidden(
  report: WorkspaceReport | null | undefined,
  extraHidden: readonly string[],
): WorkspaceReport | null | undefined {
  if (!report || extraHidden.length === 0) return report;
  const existing = report.config?.hidden_components ?? [];
  const merged = [...new Set([...existing, ...extraHidden])];
  return {
    ...report,
    config: {
      ...report.config,
      hidden_components: merged,
    },
  };
}
