import type { PlaygroundEntry } from "../types/playground";
import type { WorkspaceReport } from "../types/report";
import {
  buildPlaygroundEntriesFromReportWithSkips,
  type BuildPlaygroundModules,
  type BuildPlaygroundOptions,
  type BuildPlaygroundResult,
} from "./buildPlaygroundEntriesFromReport";
import {
  createConsumerGlobKeyFromRelPath,
  defaultConsumerGlobKeyFromRelPath,
} from "./playgroundJoin";

export type CreatePlaygroundRegistryOptions = Omit<
  BuildPlaygroundOptions,
  "globKeyFromRelPath"
> & {
  /**
   * Defaults to {@link defaultConsumerGlobKeyFromRelPath}
   * (strips `src/` or `resources/js/` then prefixes `../`).
   */
  globKeyFromRelPath?: (relPath: string) => string;
  /** Passed to {@link createConsumerGlobKeyFromRelPath} when `globKeyFromRelPath` is omitted. */
  stripPrefixes?: readonly string[];
};

/**
 * Factory for consumer apps: pass eager `import.meta.glob` modules from your Vite app.
 *
 * @example
 * ```ts
 * const modules = import.meta.glob("../components/**\/*.{tsx,jsx}", { eager: true });
 * export const buildPlaygroundEntries = createPlaygroundRegistry(modules);
 * ```
 */
export function createPlaygroundRegistry(
  modules: BuildPlaygroundModules,
  options: CreatePlaygroundRegistryOptions = {},
): (report: WorkspaceReport | null | undefined) => BuildPlaygroundResult {
  const globKeyFromRelPath =
    options.globKeyFromRelPath ??
    (options.stripPrefixes
      ? createConsumerGlobKeyFromRelPath({
          stripPrefixes: options.stripPrefixes,
        })
      : defaultConsumerGlobKeyFromRelPath);
  return (report) =>
    buildPlaygroundEntriesFromReportWithSkips(report, modules, {
      ...options,
      globKeyFromRelPath,
    });
}

/** Convenience when you only need entries (skips are still logged in dev). */
export function createPlaygroundRegistryEntriesOnly(
  modules: BuildPlaygroundModules,
  options: CreatePlaygroundRegistryOptions = {},
): (report: WorkspaceReport | null | undefined) => PlaygroundEntry[] {
  const build = createPlaygroundRegistry(modules, options);
  return (report) => build(report).entries;
}
