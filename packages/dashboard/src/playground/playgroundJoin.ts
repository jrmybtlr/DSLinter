import type { PlaygroundSpec, WorkspaceReport } from "../types/report";
import type {
  BuildPlaygroundModules,
  BuildPlaygroundOptions,
} from "./buildPlaygroundEntriesFromReport";
import { defaultEmbedGlobKeyFromRelPath } from "./embedGlobKey";
import { getModuleExport } from "./playgroundModuleExport";

export type PlaygroundJoinSkipReason = "module_not_found" | "export_not_found";

export type PlaygroundJoinSkip = {
  export_name: string;
  rel_path: string;
  globKey: string;
  reason: PlaygroundJoinSkipReason;
};

const DEFAULT_CONSUMER_STRIP_PREFIXES = ["src/", "resources/js/"] as const;

export function viteDevMode(): boolean {
  return Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
}

/**
 * Build `globKeyFromRelPath` for a registry file one level below a source root
 * (e.g. `src/playground/` or `resources/js/playground/`).
 */
export function createConsumerGlobKeyFromRelPath(
  options: {
    /** Path prefixes removed from report `rel_path` before prepending `relativePrefix`. */
    stripPrefixes?: readonly string[];
    /** Prepended to the stripped path (default `../`). */
    relativePrefix?: string;
  } = {},
): (relPath: string) => string {
  const stripPrefixes = options.stripPrefixes ?? DEFAULT_CONSUMER_STRIP_PREFIXES;
  const relativePrefix = options.relativePrefix ?? "../";
  return (relPath: string) => {
    let trimmed = relPath.replace(/^\/+/, "");
    for (const prefix of stripPrefixes) {
      if (trimmed.startsWith(prefix)) {
        trimmed = trimmed.slice(prefix.length);
        break;
      }
    }
    return `${relativePrefix}${trimmed}`;
  };
}

/**
 * Maps report `rel_path` to a Vite `import.meta.glob` key when the registry lives in
 * `src/playground/` or `resources/js/playground/` next to your components.
 *
 * Examples:
 * - `src/components/ui/button.tsx` → `../components/ui/button.tsx`
 * - `resources/js/Components/Icons/Activity.tsx` → `../Components/Icons/Activity.tsx`
 */
export function defaultConsumerGlobKeyFromRelPath(relPath: string): string {
  return createConsumerGlobKeyFromRelPath()(relPath);
}

export { defaultEmbedGlobKeyFromRelPath } from "./embedGlobKey";

/**
 * When `rel_path` is a bare filename (subdirectory scan), find a unique module key
 * whose path ends with `/${relPath}` (consumer glob or embed keys).
 */
export function findUniqueModuleKeyBySuffix(
  relPath: string,
  modules: BuildPlaygroundModules,
): string | undefined {
  const trimmed = relPath.replace(/^\/+/, "");
  if (trimmed.includes("/")) return undefined;

  const suffix = `/${trimmed}`;
  const candidates = Object.keys(modules).filter((key) => key.endsWith(suffix));
  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0] : undefined;
}

/**
 * Resolve a module map key for a report `rel_path` (exact glob key, then suffix fallback).
 */
export function resolveModuleKeyForRelPath(
  relPath: string,
  modules: BuildPlaygroundModules,
  globKeyFromRelPath: (relPath: string) => string,
): string | undefined {
  const primary = globKeyFromRelPath(relPath);
  if (modules[primary]) return primary;
  return findUniqueModuleKeyBySuffix(relPath, modules);
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

  const globKeyFromRelPath = options.globKeyFromRelPath ?? defaultEmbedGlobKeyFromRelPath;

  const skipped: PlaygroundJoinSkip[] = [];
  for (const spec of specs) {
    const globKey = globKeyFromRelPath(spec.rel_path);
    const resolvedKey = resolveModuleKeyForRelPath(spec.rel_path, modules, globKeyFromRelPath);
    const mod = resolvedKey ? modules[resolvedKey] : undefined;
    if (!mod) {
      skipped.push({
        export_name: spec.export_name,
        rel_path: spec.rel_path,
        globKey,
        reason: "module_not_found",
      });
      continue;
    }
    if (!getModuleExport(mod, spec.export_name)) {
      skipped.push({
        export_name: spec.export_name,
        rel_path: spec.rel_path,
        globKey: resolvedKey ?? globKey,
        reason: "export_not_found",
      });
    }
  }
  return skipped;
}

/**
 * Log skipped playground joins (module glob / export name mismatches).
 * Opt-in via `logJoinSkips: true` on {@link buildPlaygroundEntriesFromReportWithSkips}.
 */
export function logPlaygroundJoinSkips(
  skipped: PlaygroundJoinSkip[],
  options?: { label?: string },
): void {
  if (!skipped.length) return;
  if (!viteDevMode()) return;

  const label = options?.label ?? "[dslinter] playground preview";
  console.warn(`${label}: ${skipped.length} component(s) have a scan row but no live preview.`);
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
  return report?.playgrounds?.find((p) => p.export_name === componentId || p.id === componentId);
}

export function findPlaygroundJoinSkip(
  skipped: PlaygroundJoinSkip[] | undefined,
  componentId: string,
): PlaygroundJoinSkip | undefined {
  return skipped?.find((s) => s.export_name === componentId);
}

/** User-facing hint when a playground spec cannot join to the Vite module graph. */
export function playgroundJoinDetailMessage(
  skip: PlaygroundJoinSkip | undefined,
  spec: PlaygroundSpec | undefined,
): string | null {
  if (skip?.reason === "module_not_found") {
    const { globKey, rel_path } = skip;
    const subdirHint = !rel_path.includes("/")
      ? " This usually means the scanner was run from a subdirectory. Re-run from the project root: npx dslinter ."
      : "";
    if (globKey.startsWith("@dslinter-scan/")) {
      return [
        `Expected module key "${globKey}" but the dslinter Vite plugin did not load it.`,
        `Use <DashboardLayout autoPlayground /> and run via npx dslinter (zero vite.config changes), or add plugins: [dslinter()] from dslinter/vite to vite.config.ts.`,
        `Run the scanner from the project root so rel_path "${rel_path}" matches files under DSLINTER_SCAN_ROOT.`,
      ].join(" ");
    }
    return [
      `Vite glob is missing key "${globKey}" for report path "${rel_path}".`,
      `Prefer <DashboardLayout autoPlayground /> with plugins: [dslinter()] from dslinter/vite, or run npx dslinter init for a custom buildRegistry.ts glob.`,
      subdirHint,
    ]
      .filter(Boolean)
      .join("");
  }
  if (skip?.reason === "export_not_found") {
    return `Module loaded but named export "${skip.export_name}" was not found. Use export function ${skip.export_name}(…) in ${skip.rel_path}.`;
  }
  if (spec) {
    return `Report path: ${spec.rel_path} (export ${spec.export_name}). Use autoPlayground with dslinter/vite, or ensure buildRegistry.ts glob covers this file.`;
  }
  return null;
}
