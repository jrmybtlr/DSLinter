import type {
  ComponentDefinition,
  DeclaredPropKind,
  PlaygroundSpec,
  UsageSummary,
  WorkspaceReport,
} from "../types/report";
import { normalizedPropKinds } from "./propCoerce";

/**
 * Report lookups shared by playground builders.
 *
 * These intentionally mirror the previous `.find()` semantics (first match
 * wins). Keeping them together avoids each module inventing its own matcher.
 */

/** Resolve a catalog id (`export_name` or legacy `id`) to its playground spec. */
export function findPlaygroundSpec(
  report: WorkspaceReport | null | undefined,
  componentId: string,
): PlaygroundSpec | undefined {
  return report?.playgrounds?.find(
    (spec) => spec.export_name === componentId || spec.id === componentId,
  );
}

/** First spec emitted for a scanner `rel_path`. */
export function findPlaygroundSpecByRelPath(
  report: WorkspaceReport | null | undefined,
  relPath: string,
): PlaygroundSpec | undefined {
  return report?.playgrounds?.find((spec) => spec.rel_path === relPath);
}

/** First spec emitted for an exact export name. */
export function findPlaygroundSpecForExport(
  report: WorkspaceReport | null | undefined,
  exportName: string,
): PlaygroundSpec | undefined {
  return report?.playgrounds?.find((spec) => spec.export_name === exportName);
}

/** Rolled-up usage row for an export name. */
export function usageForExportName(
  report: WorkspaceReport | null | undefined,
  exportName: string,
): UsageSummary | undefined {
  return report?.usage_by_component?.find((usage) => usage.component === exportName);
}

/** Normalized TS-inferred prop kinds for an export (if the scanner emitted them). */
export function propKindsForExport(
  report: WorkspaceReport | null | undefined,
  exportName: string,
): Partial<Record<string, DeclaredPropKind>> | undefined {
  return normalizedPropKinds(findPlaygroundSpecForExport(report, exportName)?.declared_prop_kinds);
}

/** First component definition with this export name across scanned files. */
export function definitionForExport(
  report: WorkspaceReport | null | undefined,
  exportName: string,
): ComponentDefinition | undefined {
  for (const file of report?.files ?? []) {
    const definition = file.definitions?.find((def) => def.name === exportName);
    if (definition) return definition;
  }
  return undefined;
}
