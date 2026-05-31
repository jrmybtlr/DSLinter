import { createElement, type ComponentType } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type { PlaygroundSpec, UsageSummary, WorkspaceReport } from "../types/report";
import type { PlaygroundEntry, PlaygroundMeta } from "../types/playground";
import type { PlaygroundPreviewComponent } from "../types/preview";
import {
  defaultEmbedGlobKeyFromRelPath,
  diagnosePlaygroundJoinSkips,
  logPlaygroundJoinSkips,
  resolveModuleKeyForRelPath,
  type PlaygroundJoinSkip,
} from "./playgroundJoin";
import {
  definitionPathsForName,
  isCatalogComponentHidden,
} from "../dashboard/catalogVisibility";
import { collectDefinedPlaygrounds } from "./collectDefinedPlaygrounds";
import {
  buildCompoundPlaygroundEntries,
  upgradeRootEntriesWithCompoundPreview,
} from "./buildCompoundPlaygroundEntries";
import { mergePlaygroundEntries } from "./mergePlaygroundEntries";
import {
  componentAcceptsChildren,
  controlsForSpec,
  ensureChildrenControl,
} from "./controls";
import { genericUsageSnippet } from "./snippet";
import { mergeStaticDefaults, normalizedPropKinds, valuesToComponentProps } from "./propCoerce";

export type BuildPlaygroundModules = Record<string, Record<string, unknown>>;

export type BuildPlaygroundOptions = {
  /** Maps report `rel_path` to a key in `modules` (from `import.meta.glob`). */
  globKeyFromRelPath?: (relPath: string) => string;
  controlOverrides?: Record<string, PlaygroundControl[]>;
  staticDefaults?: Record<string, Record<string, unknown>>;
  /** When true (default in Vite dev), log specs that failed to join to `modules`. */
  logJoinSkips?: boolean;
};

export type BuildPlaygroundResult = {
  entries: PlaygroundEntry[];
  skipped: PlaygroundJoinSkip[];
};

function usageForExportName(
  report: WorkspaceReport | null | undefined,
  exportName: string,
): UsageSummary | undefined {
  return report?.usage_by_component?.find((u) => u.component === exportName);
}

export type { PlaygroundJoinSkip, PlaygroundJoinSkipReason } from "./playgroundJoin";
export {
  createConsumerGlobKeyFromRelPath,
  defaultConsumerGlobKeyFromRelPath,
  defaultEmbedGlobKeyFromRelPath,
  diagnosePlaygroundJoinSkips,
  findPlaygroundJoinSkip,
  findPlaygroundSpec,
  logPlaygroundJoinSkips,
} from "./playgroundJoin";

function getExport(
  mod: Record<string, unknown>,
  exportName: string,
): ComponentType<Record<string, unknown>> | undefined {
  const x = mod[exportName];
  if (typeof x === "function") return x as ComponentType<Record<string, unknown>>;
  return undefined;
}

/** Sidebar / URL id — matches catalog component names (`export_name`). */
export function playgroundCatalogId(spec: PlaygroundSpec): string {
  return spec.export_name;
}

/** Resolve a catalog name to a loaded playground entry. */
export function resolvePlaygroundEntry(
  entries: PlaygroundEntry[],
  catalogName: string,
): PlaygroundEntry | undefined {
  const byId = entries.find((e) => e.id === catalogName);
  if (byId) return byId;
  return entries.find(
    (e) =>
      e.meta.title === catalogName ||
      e.modulePath.includes(`/${catalogName}.`) ||
      e.modulePath.endsWith(`/${catalogName}.tsx`) ||
      e.modulePath.endsWith(`/${catalogName}.jsx`),
  );
}

/** Build playground entries from report specs + eager Vite modules. */
export function buildPlaygroundEntriesFromReportWithSkips(
  report: WorkspaceReport | null | undefined,
  modules: BuildPlaygroundModules,
  options: BuildPlaygroundOptions = {},
): BuildPlaygroundResult {
  const specs = report?.playgrounds;
  const globKeyFromRelPath =
    options.globKeyFromRelPath ?? defaultEmbedGlobKeyFromRelPath;
  const controlOverrides = options.controlOverrides ?? {};
  const staticDefaultsMap = options.staticDefaults ?? {};

  const skipped = specs?.length
    ? diagnosePlaygroundJoinSkips(report, modules, {
        globKeyFromRelPath,
      })
    : [];
  const shouldLog = options.logJoinSkips ?? viteDevMode();
  if (shouldLog) logPlaygroundJoinSkips(skipped);

  const autoEntries: PlaygroundEntry[] = [];
  if (!specs?.length) {
    const manualOnly = collectDefinedPlaygrounds(modules);
    return { entries: mergePlaygroundEntries([], manualOnly), skipped };
  }

  for (const spec of specs) {
    const globKey = globKeyFromRelPath(spec.rel_path);
    const resolvedKey = resolveModuleKeyForRelPath(spec.rel_path, modules, globKeyFromRelPath);
    const mod = resolvedKey ? modules[resolvedKey] : undefined;
    if (!mod) continue;
    const Cmp = getExport(mod, spec.export_name);
    if (!Cmp) continue;

    const catalogId = playgroundCatalogId(spec);
    const declared = spec.declared_props ?? [];
    const propKinds = normalizedPropKinds(spec.declared_prop_kinds);
    const repoUsage = usageForExportName(report, spec.export_name);
    const controls = ensureChildrenControl(
      controlsForSpec(
        catalogId,
        declared,
        propKinds,
        spec.declared_prop_options,
        spec.declared_prop_defaults,
        controlOverrides,
      ),
      componentAcceptsChildren(declared, repoUsage),
    );
    const staticDefaults = staticDefaultsMap[catalogId] ?? staticDefaultsMap[spec.id] ?? {};

    const renderPreview = (values: PlaygroundArgs) => {
      const fromValues = valuesToComponentProps(controls, declared, values, propKinds);
      const merged = mergeStaticDefaults(fromValues, staticDefaults);
      return createElement(Cmp, merged);
    };

    function Preview({ values }: { values: PlaygroundArgs }) {
      return renderPreview(values);
    }

    const meta: PlaygroundMeta = {
      id: catalogId,
      title: catalogId,
      ...(spec.group ? { group: spec.group } : {}),
    };

    autoEntries.push({
      id: catalogId,
      meta,
      modulePath: resolvedKey ?? globKey,
      controls,
      usageSnippet: (values) => genericUsageSnippet(spec.export_name, values, controls),
      renderPreview,
      Preview: Preview as PlaygroundPreviewComponent,
    });
  }

  if (report) {
    upgradeRootEntriesWithCompoundPreview(autoEntries, report, modules, {
      globKeyFromRelPath,
      controlOverrides,
      staticDefaults: staticDefaultsMap,
    });
  }

  const compoundEntries = buildCompoundPlaygroundEntries(report, modules, {
    globKeyFromRelPath,
    controlOverrides,
    staticDefaults: staticDefaultsMap,
    existingIds: new Set(autoEntries.map((entry) => entry.id)),
  });
  const manualEntries = collectDefinedPlaygrounds(modules);
  const merged = mergePlaygroundEntries(
    [...autoEntries, ...compoundEntries],
    manualEntries,
  );
  return {
    entries: filterCatalogVisiblePlaygroundEntries(report, merged),
    skipped,
  };
}

function entryPathsForCatalog(
  report: WorkspaceReport | null | undefined,
  entry: PlaygroundEntry,
): string[] {
  if (!report) return [entry.modulePath];
  const fromReport = definitionPathsForName(report, entry.meta.id);
  return fromReport.length > 0 ? fromReport : [entry.modulePath];
}

function filterCatalogVisiblePlaygroundEntries(
  report: WorkspaceReport | null | undefined,
  entries: PlaygroundEntry[],
): PlaygroundEntry[] {
  if (!report) return entries;
  return entries.filter(
    (entry) =>
      !isCatalogComponentHidden(
        entry.meta.id,
        report,
        entryPathsForCatalog(report, entry),
      ),
  );
}

/** Build playground entries from report specs + eager Vite modules. */
export function buildPlaygroundEntriesFromReport(
  report: WorkspaceReport | null | undefined,
  modules: BuildPlaygroundModules,
  options: BuildPlaygroundOptions = {},
): PlaygroundEntry[] {
  return buildPlaygroundEntriesFromReportWithSkips(report, modules, options).entries;
}
