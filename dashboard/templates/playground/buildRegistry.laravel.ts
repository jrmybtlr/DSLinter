import type { PlaygroundEntry, WorkspaceReport } from "dslinter";
import { createPlaygroundRegistry } from "dslinter";

/**
 * Registry lives in `resources/js/playground/`.
 * Glob is relative to this file — covers Inertia/React components under `resources/js/`.
 */
const modules = import.meta.glob("../**/*.{tsx,jsx}", {
  eager: true,
}) as Record<string, Record<string, unknown>>;

const buildWithSkips = createPlaygroundRegistry(modules, {
  stripPrefixes: ["resources/js/", "src/"],
});

export function buildPlaygroundEntries(
  report: WorkspaceReport | null | undefined,
): PlaygroundEntry[] {
  return buildWithSkips(report).entries;
}

export function getPlaygroundJoinSkips(
  report: WorkspaceReport | null | undefined,
) {
  return buildWithSkips(report).skipped;
}
