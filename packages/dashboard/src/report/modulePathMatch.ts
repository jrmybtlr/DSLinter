function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Resolve `../components/...` (from demo `src/playground`) to path under `report.root`. */
export function resolveModuleSourcePath(reportRoot: string, modulePath: string): string {
  const rel = norm(modulePath.replace(/^\.\.\//, ""));
  const withSrc = rel.startsWith("components/") ? `src/${rel}` : rel;
  const root = norm(reportRoot).replace(/\/$/, "");
  return `${root}/${withSrc}`;
}

/** Match finding path to source file even when `report.root` differs from machine that generated JSON. */
function tailSrcComponents(p: string): string | null {
  const m = norm(p).match(/(src\/components\/.+)$/);
  return m ? m[1] : null;
}

export function pathsMatch(reportPath: string, candidate: string): boolean {
  const a = norm(reportPath);
  const b = norm(candidate);
  if (a === b) return true;
  const ta = tailSrcComponents(a);
  const tb = tailSrcComponents(b);
  if (ta && tb) return ta === tb;
  return false;
}
