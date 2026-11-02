import { createElement, type ReactNode } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type { PlaygroundSpec, WorkspaceReport } from "../types/report";
import type { PlaygroundEntry, PlaygroundMeta } from "../types/playground";
import type { PlaygroundPreviewComponent } from "../types/preview";
import {
  defaultEmbedGlobKeyFromRelPath,
  diagnosePlaygroundJoinSkips,
  logPlaygroundJoinSkips,
  resolveModuleKeyForRelPath,
  type PlaygroundJoinSkip,
} from "./playgroundJoin";
import { definitionPathsForName, isCatalogComponentHidden } from "../dashboard/catalogVisibility";
import { collectDefinedPlaygrounds } from "./collectDefinedPlaygrounds";
import { isDefinedPlayground, type DefinedPlayground } from "./definePlayground";
import { catalogIdFromPlaygroundExport } from "./catalogIdFromPlaygroundExport";
import {
  buildCompoundPlaygroundEntries,
  upgradeRootEntriesWithCompoundPreview,
} from "./buildCompoundPlaygroundEntries";
import { mergePlaygroundEntries } from "./mergePlaygroundEntries";
import { getModuleExport } from "./playgroundModuleExport";
import type { BuildPlaygroundModules } from "./playgroundModules";
import { mergeReportControlsForKit, type PlaygroundKitHints } from "./enrichKitControls";
import { shouldUseExampleTreePreview } from "./shouldUseExampleTreePreview";
import { componentAcceptsChildren, controlsForSpec, ensureChildrenControl } from "./controls";
import { genericUsageSnippet } from "./snippet";
import {
  compactOverrides,
  mergeStaticDefaults,
  normalizedPropKinds,
  valuesToComponentProps,
} from "./propCoerce";
import { findPlaygroundSpec, usageForExportName } from "./reportQueries";
import {
  createExampleComponentResolver,
  exampleTreeSnippet,
  renderExampleTree,
} from "./renderExampleTree";

/** When JSX inference fails, still merge CVA props whose keys match kit control params. */
function fallbackRootPropBindings(
  entry: PlaygroundEntry,
  hints: PlaygroundKitHints | undefined,
  report: WorkspaceReport,
): PlaygroundKitHints["rootPropBindings"] {
  const fromKit = hints?.rootPropBindings ?? [];
  if (fromKit.length > 0) return fromKit;

  const spec = findPlaygroundSpec(report, entry.id);
  if (!spec) return [];

  const paramKeys = new Set(entry.controls.map((control) => control.key));
  return (spec.declared_props ?? [])
    .filter((prop) => paramKeys.has(prop))
    .map((prop) => ({ component: spec.export_name, prop, param: prop }));
}

function enrichManualEntriesFromReport(
  entries: PlaygroundEntry[],
  modules: BuildPlaygroundModules,
  report: WorkspaceReport | null | undefined,
): PlaygroundEntry[] {
  if (!report) return entries;

  const definedById = new Map<string, DefinedPlayground>();
  for (const mod of Object.values(modules)) {
    if (!mod || typeof mod !== "object") continue;
    for (const [exportName, value] of Object.entries(mod)) {
      if (!isDefinedPlayground(value)) continue;
      const catalogId = value.playgroundMeta.id || catalogIdFromPlaygroundExport(exportName) || "";
      if (!catalogId) continue;
      definedById.set(catalogId, value);
    }
  }

  return entries.map((entry) => {
    const defined = definedById.get(entry.id);
    const bindings = fallbackRootPropBindings(entry, defined?.playgroundKitHints, report);
    if (!bindings.length) return entry;
    const controls = mergeReportControlsForKit(entry.controls, bindings, report, entry.id);
    return controls === entry.controls ? entry : { ...entry, controls };
  });
}

export type { BuildPlaygroundModules } from "./playgroundModules";

export type BuildPlaygroundOptions = {
  /** Maps report `rel_path` to a key in `modules` (from `import.meta.glob`). */
  globKeyFromRelPath?: (relPath: string) => string;
  controlOverrides?: Record<string, PlaygroundControl[]>;
  staticDefaults?: Record<string, Record<string, unknown>>;
  /** When true, log specs that failed to join to `modules` (inspect pane still shows skips). */
  logJoinSkips?: boolean;
};

export type BuildPlaygroundResult = {
  entries: PlaygroundEntry[];
  skipped: PlaygroundJoinSkip[];
};

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
    (entry) => entry.meta.title === catalogName || entry.modulePath.includes(`/${catalogName}.`),
  );
}

function buildSpecEntry(
  spec: PlaygroundSpec,
  mod: Record<string, unknown>,
  modulePath: string,
  report: WorkspaceReport,
  modules: BuildPlaygroundModules,
  controlOverrides: Record<string, PlaygroundControl[]>,
  staticDefaultsMap: Record<string, Record<string, unknown>>,
): PlaygroundEntry | null {
  const Component = getModuleExport(mod, spec.export_name);
  if (!Component) return null;

  const catalogId = playgroundCatalogId(spec);
  const declared = spec.declared_props ?? [];
  const propKinds = normalizedPropKinds(spec.declared_prop_kinds);
  const repoUsage = usageForExportName(report, spec.export_name);
  const exampleTree = spec.example_tree;
  const useExampleTree = shouldUseExampleTreePreview(spec, exampleTree, report);

  const controls = ensureChildrenControl(
    controlsForSpec(
      catalogId,
      declared,
      propKinds,
      spec.declared_prop_options,
      spec.declared_prop_defaults,
      controlOverrides,
      spec.export_name,
      spec.declared_prop_optional,
      spec.declared_prop_type_labels,
    ),
    // Example trees carry their own children — a children control would fight them.
    !useExampleTree && componentAcceptsChildren(declared, repoUsage),
    spec.export_name,
  );

  const staticDefaults = staticDefaultsMap[catalogId] ?? staticDefaultsMap[spec.id] ?? {};
  const rootPropsFromValues = (values: PlaygroundArgs) =>
    mergeStaticDefaults(
      valuesToComponentProps(controls, declared, values, propKinds, spec.export_name),
      staticDefaults,
    );

  let renderPreview: (values: PlaygroundArgs) => ReactNode;
  let usageSnippet: (values: PlaygroundArgs) => string;

  if (useExampleTree) {
    // Usage-derived preview: replay the composition captured from a real
    // call site instead of rendering the bare (often empty) root.
    const resolve = createExampleComponentResolver(mod, modules);
    renderPreview = (values) =>
      renderExampleTree(exampleTree, resolve, {
        rootProps: compactOverrides(rootPropsFromValues(values)),
      });
    usageSnippet = (values) =>
      exampleTreeSnippet(exampleTree, {
        rootProps: compactOverrides(rootPropsFromValues(values)),
      });
  } else {
    renderPreview = (values) => createElement(Component, rootPropsFromValues(values));
    usageSnippet = (values) =>
      genericUsageSnippet(spec.export_name, values, controls, rootPropsFromValues(values));
  }

  function Preview({ values }: { values: PlaygroundArgs }) {
    return renderPreview(values);
  }

  const meta: PlaygroundMeta = {
    id: catalogId,
    title: catalogId,
    ...(spec.group ? { group: spec.group } : {}),
  };

  return {
    id: catalogId,
    meta,
    modulePath,
    controls,
    usageSnippet,
    renderPreview,
    Preview: Preview as PlaygroundPreviewComponent,
  };
}

/** Build playground entries from report specs + eager Vite modules. */
export function buildPlaygroundEntriesFromReportWithSkips(
  report: WorkspaceReport | null | undefined,
  modules: BuildPlaygroundModules,
  options: BuildPlaygroundOptions = {},
): BuildPlaygroundResult {
  const specs = report?.playgrounds;
  const globKeyFromRelPath = options.globKeyFromRelPath ?? defaultEmbedGlobKeyFromRelPath;
  const controlOverrides = options.controlOverrides ?? {};
  const staticDefaultsMap = options.staticDefaults ?? {};

  const skipped = specs?.length
    ? diagnosePlaygroundJoinSkips(report, modules, { globKeyFromRelPath })
    : [];
  if (options.logJoinSkips) logPlaygroundJoinSkips(skipped);

  if (!specs?.length || !report) {
    const manualOnly = enrichManualEntriesFromReport(
      collectDefinedPlaygrounds(modules),
      modules,
      report,
    );
    return { entries: mergePlaygroundEntries([], manualOnly), skipped };
  }

  const autoEntries: PlaygroundEntry[] = [];
  for (const spec of specs) {
    const globKey = globKeyFromRelPath(spec.rel_path);
    const resolvedKey = resolveModuleKeyForRelPath(spec.rel_path, modules, globKeyFromRelPath);
    const mod = resolvedKey ? modules[resolvedKey] : undefined;
    if (!mod) continue;

    const entry = buildSpecEntry(
      spec,
      mod,
      resolvedKey ?? globKey,
      report,
      modules,
      controlOverrides,
      staticDefaultsMap,
    );
    if (entry) autoEntries.push(entry);
  }

  upgradeRootEntriesWithCompoundPreview(autoEntries, report, modules, {
    globKeyFromRelPath,
    controlOverrides,
    staticDefaults: staticDefaultsMap,
  });

  const compoundEntries = buildCompoundPlaygroundEntries(report, modules, {
    globKeyFromRelPath,
    controlOverrides,
    staticDefaults: staticDefaultsMap,
    existingIds: new Set(autoEntries.map((entry) => entry.id)),
  });
  const manualEntries = enrichManualEntriesFromReport(
    collectDefinedPlaygrounds(modules),
    modules,
    report,
  );
  const merged = mergePlaygroundEntries([...autoEntries, ...compoundEntries], manualEntries);

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
      !isCatalogComponentHidden(entry.meta.id, report, entryPathsForCatalog(report, entry)),
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
