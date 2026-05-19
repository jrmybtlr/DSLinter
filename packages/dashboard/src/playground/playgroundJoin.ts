import type { PlaygroundSpec, WorkspaceReport } from "../types/report";
import type { BuildPlaygroundModules, BuildPlaygroundOptions } from "./buildPlaygroundEntriesFromReport";

export type PlaygroundJoinSkipReason = "module_not_found" | "export_not_found";

export type PlaygroundJoinSkip = {
  export_name: string;
  rel_path: string;
  globKey: string;
  reason: PlaygroundJoinSkipReason;
};

/**
 * Maps report `rel_path` to a Vite `import.meta.glob` key when the registry lives in
 * `src/playground/` and components live under `src/components/`.
 *
 * Example: `src/components/ui/button.tsx` → `../components/ui/button.tsx`
 */
export function defaultConsumerGlobKeyFromRelPath(relPath: string): string {
  const trimmed = relPath.replace(/^\/+/, "").replace(/^src\//, "");
  return `../${trimmed}`;
}

export function defaultEmbedGlobKeyFromRelPath(relPath: string): string {
  const trimmed = relPath.replace(/^\/+/, "");
  return `@dslint-scan/${trimmed}`;
}

function getExport(
  mod: Record<string, unknown>,
  exportName: string,
): unknown {
  const x = mod[exportName];
  return typeof x === "function" ? x : undefined;
}

/**
 * For each playground spec, explain why it would not join to `modules`.
 */
export function diagnosePlaygroundJoinSkips(
  report: WorkspaceReport | null | undefined,
  modules: BuildPlaygroundModules,
  options: Pick<BuildPlaygroundOptions, "globKeyFromRelPath"> = {},
): PlaygroundJoinSkip[] {
  const specs = report?.playgrounds;
  if (!specs?.length) return [];

  const globKeyFromRelPath =
    options.globKeyFromRelPath ?? defaultEmbedGlobKeyFromRelPath;

  const skipped: PlaygroundJoinSkip[] = [];
  for (const spec of specs) {
    const globKey = globKeyFromRelPath(spec.rel_path);
    const mod = modules[globKey];
    if (!mod) {
      skipped.push({
        export_name: spec.export_name,
        rel_path: spec.rel_path,
        globKey,
        reason: "module_not_found",
      });
      continue;
    }
    if (!getExport(mod, spec.export_name)) {
      skipped.push({
        export_name: spec.export_name,
        rel_path: spec.rel_path,
        globKey,
        reason: "export_not_found",
      });
    }
  }
  return skipped;
}

/**
 * Dev-only: log skipped playground joins (module glob / export name mismatches).
 */
export function logPlaygroundJoinSkips(
  skipped: PlaygroundJoinSkip[],
  options?: { label?: string },
): void {
  if (!skipped.length) return;
  if (typeof import.meta !== "undefined" && !import.meta.env?.DEV) return;

  const label = options?.label ?? "[dslinter] playground preview";
  console.warn(
    `${label}: ${skipped.length} component(s) have a scan row but no live preview.`,
  );
  for (const s of skipped.slice(0, 12)) {
    const hint =
      s.reason === "module_not_found"
        ? `add import.meta.glob key "${s.globKey}" (from rel_path "${s.rel_path}")`
        : `export function ${s.export_name} from "${s.rel_path}"`;
    console.warn(`  - ${s.export_name}: ${hint}`);
  }
  if (skipped.length > 12) {
    console.warn(`  … and ${skipped.length - 12} more`);
  }
}

export function findPlaygroundSpec(
  report: WorkspaceReport | null | undefined,
  componentId: string,
): PlaygroundSpec | undefined {
  return report?.playgrounds?.find(
    (p) => p.export_name === componentId || p.id === componentId,
  );
}

export function findPlaygroundJoinSkip(
  skipped: PlaygroundJoinSkip[] | undefined,
  componentId: string,
): PlaygroundJoinSkip | undefined {
  return skipped?.find((s) => s.export_name === componentId);
}
