import type { PlaygroundEntry, WorkspaceReport } from "dslinter";
import { createPlaygroundRegistry } from "dslinter";

/**
 * Eager Vite glob — must cover every path in `dslinter-report.json` → `playgrounds[].rel_path`.
 * Nested paths (e.g. `src/components/ui/button.tsx`) require `**`, not a single `*`.
 */
const modules = import.meta.glob("../components/**/*.{tsx,jsx}", {
  eager: true,
}) as Record<string, Record<string, unknown>>;

const buildWithSkips = createPlaygroundRegistry(modules);

/** Live previews for the dashboard (`DashboardLayout` → `playgroundEntries`). */
export function buildPlaygroundEntries(
  report: WorkspaceReport | null | undefined,
): PlaygroundEntry[] {
  return buildWithSkips(report).entries;
}

/** Skipped joins (module glob / export mismatch) — useful for debugging previews. */
export function getPlaygroundJoinSkips(
  report: WorkspaceReport | null | undefined,
) {
  return buildWithSkips(report).skipped;
}
