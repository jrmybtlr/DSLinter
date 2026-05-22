import type { WorkspaceReport } from "../types/report";

/** Stable memo key — ignores report object identity when playground specs are unchanged. */
export function playgroundSpecsKey(
  report: WorkspaceReport | null | undefined,
): string {
  return JSON.stringify(report?.playgrounds ?? []);
}
