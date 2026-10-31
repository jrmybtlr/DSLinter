import type { ReactNode } from "react";
import type { PlaygroundArgs, PlaygroundControl, PlaygroundSelectControl } from "../types/controls";
import type {
  ComponentDefinition,
  DeclaredPropKind,
  UsageSummary,
  WorkspaceReport,
} from "../types/report";
import type { PlaygroundEntry, PlaygroundMeta } from "../types/playground";
import type { PlaygroundPreviewComponent } from "../types/preview";
import type { BuildPlaygroundModules } from "./playgroundModules";
import {
  childrenControl,
  controlForPropKind,
  mergeControlOverrides,
  resolveEffectivePropKind,
  SKIP_PLAYGROUND_PROPS,
} from "./controls";
import { compoundUsageSnippet, renderCompoundPreview } from "./compoundPreview";
import {
  detectCompoundFamily,
  familyExampleTree,
  findCompoundFamilies,
  primaryCompoundTarget,
  type CompoundFamily,
} from "./compoundFamily";
import { getModuleExport } from "./playgroundModuleExport";
import { resolveModuleKeyForRelPath } from "./playgroundJoin";
import { compactOverrides, mergeStaticDefaults, valuesToComponentProps } from "./propCoerce";
import { propKindsForExport, usageForExportName } from "./reportQueries";
import {
  createExampleComponentResolver,
  exampleTreeContainsElement,
  exampleTreeSnippet,
  renderExampleTree,
} from "./renderExampleTree";

/** Props never worth a compound panel row. */
const COMPOUND_SKIP_PROPS = new Set([...SKIP_PLAYGROUND_PROPS, "as", "asChild"]);

export type BuildCompoundPlaygroundOptions = {
  globKeyFromRelPath: (relPath: string) => string;
  controlOverrides?: Record<string, PlaygroundControl[]>;
  staticDefaults?: Record<string, Record<string, unknown>>;
  /** Catalog ids that already have a playground entry. */
  existingIds: ReadonlySet<string>;
};

function selectControl(
  key: string,
  values: string[],
  defaultSource: PlaygroundControl["defaultSource"],
): PlaygroundSelectControl {
  const defaultVal = values.includes("default") ? "default" : values[0]!;
  return {
    key,
    label: key,
    type: "select",
    default: defaultVal,
    defaultSource,
    options: values.map((value) => ({ value, label: value })),
  };
}

function controlsFromDefinitionAndUsage(
  definition: ComponentDefinition,
  usage: UsageSummary | undefined,
  controlOverrides: Record<string, PlaygroundControl[]>,
  catalogId: string,
  propKinds?: Partial<Record<string, DeclaredPropKind>>,
): PlaygroundControl[] {
  const propKeys = new Set<string>(definition.declared_props ?? []);

  // Include props observed in usage when the scanner did not declare them.
  for (const key of Object.keys(usage?.prop_frequencies ?? {})) {
    if (!COMPOUND_SKIP_PROPS.has(key)) propKeys.add(key);
  }

  const controls: PlaygroundControl[] = [];

  for (const key of [...propKeys].sort((a, b) => a.localeCompare(b))) {
    if (COMPOUND_SKIP_PROPS.has(key)) continue;

    if (key === "children") {
      controls.push({ ...childrenControl(catalogId), defaultSource: "example" });
      continue;
    }

    const propOptions = definition.declared_prop_options?.[key];
    if (propOptions && propOptions.length >= 2) {
      const declaredDefault = definition.declared_prop_defaults?.[key];
      controls.push({
        ...selectControl(key, propOptions, declaredDefault == null ? "example" : "type"),
        default: declaredDefault ?? (propOptions.includes("default") ? "default" : propOptions[0]!),
      });
      continue;
    }

    const valueFrequencies = usage?.prop_value_frequencies?.[key];
    if (valueFrequencies && Object.keys(valueFrequencies).length >= 2) {
      const values = Object.entries(valueFrequencies)
        .sort((a, b) => b[1] - a[1])
        .map(([value]) => value);
      controls.push(selectControl(key, values, "example"));
      continue;
    }

    const kind = resolveEffectivePropKind(key, propKinds);
    controls.push(controlForPropKind(key, kind, { defaultSource: "example" }));
  }

  if (
    !controls.some((control) => control.key === "children") &&
    (propKeys.has("children") || (usage?.prop_frequencies?.children ?? 0) > 0)
  ) {
    controls.push({ ...childrenControl(catalogId), defaultSource: "example" });
  }

  return mergeControlOverrides(controls, controlOverrides[catalogId]);
}

/** Coerce playground panel values for compound previews (exported for unit tests). */
export function valuesToProps(
  controls: PlaygroundControl[],
  values: PlaygroundArgs,
  exportName?: string,
): Record<string, unknown> {
  return valuesToComponentProps(controls, [], values, undefined, exportName);
}

export function buildCompoundPlaygroundEntryForTarget(
  family: CompoundFamily,
  targetName: string,
  mod: Record<string, unknown>,
  modulePath: string,
  report: WorkspaceReport,
  modules: BuildPlaygroundModules,
  options: Pick<BuildCompoundPlaygroundOptions, "controlOverrides" | "staticDefaults">,
): PlaygroundEntry | null {
  const definition = family.exports.get(targetName);
  if (!definition) return null;
  if (!getModuleExport(mod, targetName)) return null;

  const controls = controlsFromDefinitionAndUsage(
    definition,
    usageForExportName(report, targetName),
    options.controlOverrides ?? {},
    targetName,
    propKindsForExport(report, targetName),
  );
  const staticDefaults = options.staticDefaults?.[targetName] ?? {};
  const propsFromValues = (values: PlaygroundArgs) =>
    mergeStaticDefaults(valuesToProps(controls, values, targetName), staticDefaults);

  // Prefer the usage-derived family composition: the target renders in its
  // real context (e.g. BreadcrumbItem inside Breadcrumb → BreadcrumbList).
  const exampleTree = familyExampleTree(report, family);
  const exampleForTarget =
    exampleTree && exampleTreeContainsElement(exampleTree, targetName) ? exampleTree : undefined;

  let renderPreview: (values: PlaygroundArgs) => ReactNode;
  let usageSnippet: (values: PlaygroundArgs) => string;

  if (exampleForTarget) {
    const resolve = createExampleComponentResolver(mod, modules);
    renderPreview = (values) =>
      renderExampleTree(exampleForTarget, resolve, {
        target: { name: targetName, props: compactOverrides(propsFromValues(values)) },
      });
    usageSnippet = (values) =>
      exampleTreeSnippet(exampleForTarget, {
        target: { name: targetName, props: compactOverrides(propsFromValues(values)) },
      });
  } else {
    renderPreview = (values) =>
      renderCompoundPreview(family, targetName, mod, propsFromValues(values));
    usageSnippet = (values) => compoundUsageSnippet(family, targetName, values, controls);
  }

  function Preview({ values }: { values: PlaygroundArgs }) {
    return renderPreview(values);
  }

  const meta: PlaygroundMeta = {
    id: targetName,
    title: targetName,
    ...(family.group ? { group: family.group } : {}),
  };

  return {
    id: targetName,
    meta,
    modulePath,
    controls,
    usageSnippet,
    renderPreview,
    Preview: Preview as PlaygroundPreviewComponent,
  };
}

function resolveFamilyModule(
  family: CompoundFamily,
  modules: BuildPlaygroundModules,
  globKeyFromRelPath: (relPath: string) => string,
): { modulePath: string; mod: Record<string, unknown> } | undefined {
  const globKey = globKeyFromRelPath(family.relPath);
  const resolvedKey = resolveModuleKeyForRelPath(family.relPath, modules, globKeyFromRelPath);
  const mod = resolvedKey ? modules[resolvedKey] : undefined;
  if (!mod || !getModuleExport(mod, family.root)) return undefined;
  return { modulePath: resolvedKey ?? globKey, mod };
}

/**
 * Synthesize compound playground entries for sub-exports (e.g. DropdownMenu)
 * that share a stem-rooted provider module with sibling exports.
 */
export function buildCompoundPlaygroundEntries(
  report: WorkspaceReport | null | undefined,
  modules: BuildPlaygroundModules,
  options: BuildCompoundPlaygroundOptions,
): PlaygroundEntry[] {
  if (!report) return [];

  const entries: PlaygroundEntry[] = [];

  for (const family of findCompoundFamilies(report)) {
    const resolved = resolveFamilyModule(family, modules, options.globKeyFromRelPath);
    if (!resolved) continue;

    for (const exportName of family.exports.keys()) {
      if (exportName === family.root) continue;
      if (options.existingIds.has(exportName)) continue;

      const entry = buildCompoundPlaygroundEntryForTarget(
        family,
        exportName,
        resolved.mod,
        resolved.modulePath,
        report,
        modules,
        options,
      );
      if (entry) entries.push(entry);
    }
  }

  entries.sort((a, b) => a.meta.title.localeCompare(b.meta.title));
  return entries;
}

/**
 * Replace auto-generated root entries with composed compound previews
 * (e.g. `DropdownMenu` shows trigger + content instead of bare root).
 */
export function upgradeRootEntriesWithCompoundPreview(
  autoEntries: PlaygroundEntry[],
  report: WorkspaceReport,
  modules: BuildPlaygroundModules,
  options: Pick<
    BuildCompoundPlaygroundOptions,
    "globKeyFromRelPath" | "controlOverrides" | "staticDefaults"
  >,
): void {
  for (const family of findCompoundFamilies(report)) {
    // Usage-derived example previews (built in the spec loop) beat the
    // Trigger/Content heuristic — leave those root entries alone.
    if (familyExampleTree(report, family)) continue;

    const targetName = primaryCompoundTarget(family);
    if (!targetName || targetName === family.root) continue;

    const resolved = resolveFamilyModule(family, modules, options.globKeyFromRelPath);
    if (!resolved) continue;

    const index = autoEntries.findIndex(
      (entry) => entry.id === family.root && entry.modulePath === resolved.modulePath,
    );
    if (index < 0) continue;

    const compoundEntry = buildCompoundPlaygroundEntryForTarget(
      family,
      targetName,
      resolved.mod,
      resolved.modulePath,
      report,
      modules,
      options,
    );
    if (!compoundEntry) continue;

    autoEntries[index] = {
      ...autoEntries[index]!,
      controls: compoundEntry.controls,
      renderPreview: compoundEntry.renderPreview,
      Preview: compoundEntry.Preview,
      usageSnippet: compoundEntry.usageSnippet,
    };
  }
}

export { detectCompoundFamily, familyExampleTree, findCompoundFamilies, primaryCompoundTarget };
export type { CompoundFamily } from "./compoundFamily";
export { compoundUsageSnippet, renderCompoundPreview } from "./compoundPreview";
