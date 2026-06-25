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

const SRC_COMPONENTS = "src/components/";

/** Match finding path to source file even when `report.root` differs from machine that generated JSON. */
function tailSrcComponents(p: string): string | null {
  const normalized = norm(p);
  const idx = normalized.indexOf(SRC_COMPONENTS);
  return idx === -1 ? null : normalized.slice(idx);
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
