import type { LintFinding, WorkspaceReport } from "../types/report";

function normalizeOnePath(path: string, root: string): string {
  if (!path) return path;
  const normRoot = root.replace(/\\/g, "/").replace(/\/$/, "");
  const normPath = path.replace(/\\/g, "/");
  if (normPath.startsWith(normRoot + "/")) {
    return normPath.slice(normRoot.length + 1);
  }
  if (normPath === normRoot) return ".";
  return normPath;
}

/** Make report paths relative to root for portable agent context. */
export function normalizeReportPaths(report: WorkspaceReport): WorkspaceReport {
  const root = report.root.replace(/\\/g, "/");
  const rel = (p: string) => normalizeOnePath(p, root);

  return {
    ...report,
    files: (report.files ?? []).map((f) => ({
      ...f,
      path: rel(f.path),
    })),
    findings: (report.findings ?? []).map((f) => ({
      ...f,
      path: rel(f.path),
    })),
    duplicate_components: (report.duplicate_components ?? []).map((d) => ({
      ...d,
      locations: d.locations.map(rel),
    })),
    usage_by_component: (report.usage_by_component ?? []).map((u) => ({
      ...u,
      files: u.files.map(rel),
      usage_locations: u.usage_locations?.map((loc) => ({
        ...loc,
        path: rel(loc.path),
      })),
    })),
    css_tokens: report.css_tokens
      ? {
          ...report.css_tokens,
          definitions: report.css_tokens.definitions.map((d) => ({
            ...d,
            path: rel(d.path),
          })),
          usage_by_token: report.css_tokens.usage_by_token.map((u) => ({
            ...u,
            files: u.files.map(rel),
            usage_locations: u.usage_locations?.map((loc) => ({
              ...loc,
              path: rel(loc.path),
            })),
          })),
        }
      : undefined,
  };
}

export function findingMatchesPath(finding: LintFinding, pathFilter: string): boolean {
  const norm = pathFilter.replace(/\\/g, "/");
  const fp = finding.path.replace(/\\/g, "/");
  return fp === norm || fp.endsWith("/" + norm) || fp.endsWith(norm);
}
