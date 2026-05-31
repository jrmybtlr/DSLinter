import { createElement, type ReactNode } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type {
  ComponentDefinition,
  DefinitionKind,
  PlaygroundSpec,
  UsageSummary,
  WorkspaceReport,
} from "../types/report";
import type { PlaygroundEntry, PlaygroundMeta } from "../types/playground";
import type { PlaygroundPreviewComponent } from "../types/preview";
import type { BuildPlaygroundModules } from "./buildPlaygroundEntriesFromReport";
import { getModuleExport } from "./playgroundModuleExport";
import { resolveModuleKeyForRelPath } from "./playgroundJoin";

const PLAYABLE_KINDS = new Set<DefinitionKind>([
  "function",
  "class",
  "const_arrow",
  "const_function",
  "wrapped_component",
]);

const CONTENT_SUFFIXES = ["Menu", "Content", "Panel", "Body", "Viewport"] as const;

export type CompoundFamily = {
  relPath: string;
  group?: string;
  root: string;
  trigger?: string;
  content?: string;
  /** Playable export name → definition (first wins on duplicates). */
  exports: Map<string, ComponentDefinition>;
};

export type BuildCompoundPlaygroundOptions = {
  globKeyFromRelPath: (relPath: string) => string;
  controlOverrides?: Record<string, PlaygroundControl[]>;
  staticDefaults?: Record<string, Record<string, unknown>>;
  /** Catalog ids that already have a playground entry. */
  existingIds: ReadonlySet<string>;
};

function isPlayableDefinition(def: ComponentDefinition): boolean {
  return PLAYABLE_KINDS.has(def.kind);
}

function fileStemFromRelPath(relPath: string): string {
  const base = relPath.split("/").pop() ?? relPath;
  return base.replace(/\.(tsx|jsx)$/i, "");
}

function normalizedName(value: string): string {
  return value
    .replace(/\.playground$/i, "")
    .split("")
    .filter((c) => c !== "-" && c !== "_")
    .join("")
    .toLowerCase();
}

function trimLeadingSlashes(value: string): string {
  let i = 0;
  while (i < value.length && value.charCodeAt(i) === 47) i += 1;
  return value.slice(i);
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(0, end);
}

function relPathFromAbsolute(filePath: string, reportRoot: string): string {
  const normalizedRoot = trimTrailingSlashes(reportRoot);
  if (filePath.startsWith(normalizedRoot + "/")) {
    return filePath.slice(normalizedRoot.length + 1);
  }
  if (filePath.startsWith(normalizedRoot)) {
    return trimLeadingSlashes(filePath.slice(normalizedRoot.length));
  }
  return trimLeadingSlashes(filePath);
}

/** Group playable definitions by scanner rel_path. */
export function groupPlayableDefinitionsByFile(
  report: WorkspaceReport,
): Map<string, Map<string, ComponentDefinition>> {
  const byFile = new Map<string, Map<string, ComponentDefinition>>();
  for (const file of report.files ?? []) {
    const rel = relPathFromAbsolute(file.path, report.root);
    for (const def of file.definitions ?? []) {
      if (!isPlayableDefinition(def)) continue;
      let exports = byFile.get(rel);
      if (!exports) {
        exports = new Map();
        byFile.set(rel, exports);
      }
      if (!exports.has(def.name)) exports.set(def.name, def);
    }
  }
  return byFile;
}

function findTriggerExport(
  stem: string,
  root: string,
  names: Iterable<string>,
): string | undefined {
  const preferred = `${stem}Trigger`;
  const list = [...names];
  if (list.includes(preferred)) return preferred;
  return list.find((n) => n !== root && n.endsWith("Trigger"));
}

function findContentExport(
  stem: string,
  root: string,
  trigger: string | undefined,
  names: Iterable<string>,
): string | undefined {
  const candidates = [...names].filter((n) => n !== root && n !== trigger);
  for (const suffix of CONTENT_SUFFIXES) {
    const preferred = `${stem}${suffix}`;
    if (candidates.includes(preferred)) return preferred;
  }
  return candidates.find((n) => CONTENT_SUFFIXES.some((suffix) => n.endsWith(suffix)));
}

/** Detect a stem-rooted compound component family in one module. */
export function detectCompoundFamily(
  relPath: string,
  exports: Map<string, ComponentDefinition>,
  group?: string,
): CompoundFamily | null {
  if (exports.size < 2) return null;
  const stem = fileStemFromRelPath(relPath);
  const root = [...exports.keys()].find((name) => normalizedName(name) === normalizedName(stem));
  if (!root) return null;

  const names = [...exports.keys()];
  const trigger = findTriggerExport(root, root, names);
  const content = findContentExport(root, root, trigger, names);

  return {
    relPath,
    group,
    root,
    trigger,
    content,
    exports,
  };
}

function playgroundGroupForFile(report: WorkspaceReport, relPath: string): string | undefined {
  const spec = report.playgrounds?.find((p) => p.rel_path === relPath);
  return spec?.group ?? undefined;
}

/** All compound families in a workspace report. */
export function findCompoundFamilies(report: WorkspaceReport): CompoundFamily[] {
  const byFile = groupPlayableDefinitionsByFile(report);
  const families: CompoundFamily[] = [];
  for (const [relPath, exports] of byFile) {
    const family = detectCompoundFamily(relPath, exports, playgroundGroupForFile(report, relPath));
    if (family) families.push(family);
  }
  return families;
}

function usageForExportName(report: WorkspaceReport, exportName: string): UsageSummary | undefined {
  return report.usage_by_component?.find((u) => u.component === exportName);
}

function isLikelyBooleanProp(name: string): boolean {
  const n = name.toLowerCase();
  if (n === "disabled" || n === "loading" || n === "aschild") return true;
  if (n.startsWith("is") || n.startsWith("has")) return true;
  if (n.startsWith("show") || n.startsWith("hide")) return true;
  return false;
}

function defaultStringForProp(key: string): string {
  if (key === "href") return "/governance";
  const k = key.toLowerCase();
  if (k === "title" || k === "label" || k === "text" || k === "name" || k === "heading") {
    return "Label";
  }
  return key;
}

function controlsFromDefinitionAndUsage(
  def: ComponentDefinition,
  usage: UsageSummary | undefined,
  controlOverrides: Record<string, PlaygroundControl[]>,
  catalogId: string,
): PlaygroundControl[] {
  const override = controlOverrides[catalogId];
  if (override) return override;

  const declared = def.declared_props ?? [];
  const skip = new Set(["key", "ref", "as", "asChild"]);
  const propKeys = new Set<string>(declared);

  // Include props observed in usage when the scanner did not declare them.
  if (usage?.prop_frequencies) {
    for (const key of Object.keys(usage.prop_frequencies)) {
      if (!skip.has(key)) propKeys.add(key);
    }
  }

  const out: PlaygroundControl[] = [];

  for (const key of [...propKeys].sort((a, b) => a.localeCompare(b))) {
    if (skip.has(key)) continue;
    if (key === "children") {
      out.push({
        key: "children",
        label: "children",
        type: "string",
        default: "Example",
        defaultSource: "example",
        placeholder: "Slot content",
      });
      continue;
    }

    const options = def.declared_prop_options?.[key];
    if (options && options.length >= 2) {
      const defaultVal =
        def.declared_prop_defaults?.[key] ??
        (options.includes("default") ? "default" : options[0]!);
      out.push({
        key,
        label: key,
        type: "select",
        default: defaultVal,
        defaultSource: def.declared_prop_defaults?.[key] == null ? "example" : "type",
        options: options.map((value) => ({ value, label: value })),
      });
      continue;
    }

    const freqValues = usage?.prop_value_frequencies?.[key];
    if (freqValues && Object.keys(freqValues).length >= 2) {
      const sorted = Object.entries(freqValues).sort((a, b) => b[1] - a[1]);
      const values = sorted.map(([v]) => v);
      out.push({
        key,
        label: key,
        type: "select",
        default: values[0]!,
        defaultSource: "example",
        options: values.map((value) => ({ value, label: value })),
      });
      continue;
    }

    if (isLikelyBooleanProp(key)) {
      out.push({ key, label: key, type: "boolean", default: false, defaultSource: "example" });
    } else {
      out.push({
        key,
        label: key,
        type: "string",
        default: defaultStringForProp(key),
        defaultSource: "example",
        placeholder: key,
      });
    }
  }

  if (
    !out.some((c) => c.key === "children") &&
    (propKeys.has("children") || (usage?.prop_frequencies?.children ?? 0) > 0)
  ) {
    out.push({
      key: "children",
      label: "children",
      type: "string",
      default: "Example",
      defaultSource: "example",
      placeholder: "Slot content",
    });
  }

  return out;
}

function valuesToProps(
  controls: PlaygroundControl[],
  values: PlaygroundArgs,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const control of controls) {
    const key = control.key;
    if (key === "key" || key === "ref") continue;
    if (key === "children") {
      const v = values.children;
      o[key] = v !== undefined && v !== null && String(v).length > 0 ? String(v) : "Example";
      continue;
    }
    if (control.type === "boolean") {
      o[key] = Boolean(values[key]);
    } else if (control.type === "number") {
      const raw = values[key];
      const n = typeof raw === "number" ? raw : Number(raw);
      o[key] = Number.isFinite(n) ? n : 0;
    } else {
      o[key] = values[key];
    }
  }
  return o;
}

function mergeStaticDefaults(
  fromValues: Record<string, unknown>,
  staticDefaults: Record<string, unknown>,
): Record<string, unknown> {
  const o = { ...fromValues };
  for (const [k, v] of Object.entries(staticDefaults)) {
    const cur = o[k];
    if (cur === undefined || cur === "") o[k] = v;
  }
  return o;
}

function placeholderPartChildren(exportName: string): ReactNode {
  if (exportName.endsWith("Separator")) return null;
  if (exportName.endsWith("Header") || exportName.endsWith("Label")) {
    return "Section";
  }
  if (exportName.includes("Item") || exportName.endsWith("Action")) {
    return "Example item";
  }
  return "Example";
}

function demoMenuChildren(
  family: CompoundFamily,
  mod: Record<string, unknown>,
  targetName: string,
): ReactNode {
  const ItemExport = [...family.exports.keys()].find((n) => n.endsWith("Item") && n !== targetName);
  const SepExport = [...family.exports.keys()].find((n) => n.endsWith("Separator"));

  const nodes: ReactNode[] = [];

  if (targetName !== family.content) {
    const Target = getModuleExport(mod, targetName);
    if (Target) {
      nodes.push(createElement(Target, null, placeholderPartChildren(targetName)));
    }
  }

  if (ItemExport && targetName !== ItemExport) {
    const Item = getModuleExport(mod, ItemExport);
    if (Item) nodes.push(createElement(Item, null, "Example item"));
  }
  if (SepExport && targetName !== SepExport && nodes.length > 0) {
    const Sep = getModuleExport(mod, SepExport);
    if (Sep) nodes.push(createElement(Sep));
  }
  if (ItemExport && targetName !== ItemExport && nodes.length > 1) {
    const Item = getModuleExport(mod, ItemExport);
    if (Item) nodes.push(createElement(Item, null, "Another item"));
  }

  if (nodes.length === 0) {
    return placeholderPartChildren(targetName);
  }
  return nodes;
}

function renderCompoundPreview(
  family: CompoundFamily,
  targetName: string,
  mod: Record<string, unknown>,
  props: Record<string, unknown>,
): ReactNode {
  const Root = getModuleExport(mod, family.root);
  const Target = getModuleExport(mod, targetName);
  if (!Root || !Target) return null;

  const triggerProps: Record<string, unknown> = { children: "Open menu" };
  const Trigger = family.trigger ? getModuleExport(mod, family.trigger) : undefined;

  if (targetName === family.root) {
    return createElement(Root, props);
  }

  if (targetName === family.trigger && Trigger) {
    return createElement(
      Root,
      { defaultOpen: true },
      createElement(Trigger, { ...triggerProps, ...props }),
    );
  }

  const triggerNode =
    Trigger && targetName !== family.trigger ? createElement(Trigger, triggerProps) : null;
  const rootProps = { defaultOpen: true };

  const targetChildren: ReactNode =
    props.children !== undefined
      ? (props.children as ReactNode)
      : placeholderPartChildren(targetName);

  const targetNode = createElement(Target, props, targetChildren);

  if (targetName === family.content) {
    return createElement(Root, rootProps, triggerNode, targetNode);
  }

  if (family.content) {
    const Content = getModuleExport(mod, family.content);
    if (Content) {
      const menuChildren =
        targetName === family.content ? targetNode : demoMenuChildren(family, mod, targetName);
      return createElement(
        Root,
        rootProps,
        triggerNode,
        createElement(Content, null, menuChildren),
      );
    }
  }

  return createElement(Root, rootProps, triggerNode, targetNode);
}

function compoundUsageSnippet(
  family: CompoundFamily,
  targetName: string,
  values: PlaygroundArgs,
  controls: PlaygroundControl[],
): string {
  const propsStr = controls
    .filter((c) => c.key !== "children")
    .map((c) => `${c.key}={${JSON.stringify(values[c.key])}}`)
    .join(" ");

  const targetOpen = propsStr.length > 0 ? `<${targetName} ${propsStr}` : `<${targetName}`;

  const trigger = family.trigger ?? "button";
  const content = family.content;

  if (targetName === family.root) {
    return propsStr.length > 0 ? `<${targetName} ${propsStr} />` : `<${targetName} />`;
  }

  if (targetName === family.trigger) {
    return `<${family.root}>\n  <${targetName}>Open menu</${targetName}>\n</${family.root}>`;
  }

  if (targetName === content) {
    return `<${family.root}>\n  <${trigger}>Open menu</${trigger}>\n  ${targetOpen}>…</${targetName}>\n</${family.root}>`;
  }

  if (content) {
    return `<${family.root}>\n  <${trigger}>Open menu</${trigger}>\n  <${content}>\n    ${targetOpen}>…</${targetName}>\n  </${content}>\n</${family.root}>`;
  }

  return `<${family.root}>\n  <${trigger}>Open menu</${trigger}>\n  ${targetOpen}>…</${targetName}>\n</${family.root}>`;
}

/** Primary preview target for a compound family (content, then trigger). */
export function primaryCompoundTarget(family: CompoundFamily): string | undefined {
  return family.content ?? family.trigger;
}

export function buildCompoundPlaygroundEntryForTarget(
  family: CompoundFamily,
  targetName: string,
  mod: Record<string, unknown>,
  modulePath: string,
  report: WorkspaceReport,
  options: Pick<
    BuildCompoundPlaygroundOptions,
    "controlOverrides" | "staticDefaults"
  >,
): PlaygroundEntry | null {
  const def = family.exports.get(targetName);
  if (!def) return null;
  if (!getModuleExport(mod, targetName)) return null;

  const usage = usageForExportName(report, targetName);
  const controls = controlsFromDefinitionAndUsage(
    def,
    usage,
    options.controlOverrides ?? {},
    targetName,
  );
  const staticDefaults = options.staticDefaults?.[targetName] ?? {};

  const renderPreview = (values: PlaygroundArgs) => {
    const props = mergeStaticDefaults(valuesToProps(controls, values), staticDefaults);
    return renderCompoundPreview(family, targetName, mod, props);
  };

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
    usageSnippet: (values) => compoundUsageSnippet(family, targetName, values, controls),
    renderPreview,
    Preview: Preview as PlaygroundPreviewComponent,
  };
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

  const out: PlaygroundEntry[] = [];
  const families = findCompoundFamilies(report);

  for (const family of families) {
    const globKey = options.globKeyFromRelPath(family.relPath);
    const resolvedKey = resolveModuleKeyForRelPath(
      family.relPath,
      modules,
      options.globKeyFromRelPath,
    );
    const mod = resolvedKey ? modules[resolvedKey] : undefined;
    if (!mod) continue;
    if (!getModuleExport(mod, family.root)) continue;

    for (const exportName of family.exports.keys()) {
      if (exportName === family.root) continue;
      if (options.existingIds.has(exportName)) continue;

      const entry = buildCompoundPlaygroundEntryForTarget(
        family,
        exportName,
        mod,
        resolvedKey ?? globKey,
        report,
        options,
      );
      if (entry) out.push(entry);
    }
  }

  out.sort((a, b) => a.meta.title.localeCompare(b.meta.title));
  return out;
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
  const families = findCompoundFamilies(report);

  for (const family of families) {
    const targetName = primaryCompoundTarget(family);
    if (!targetName || targetName === family.root) continue;

    const globKey = options.globKeyFromRelPath(family.relPath);
    const resolvedKey = resolveModuleKeyForRelPath(
      family.relPath,
      modules,
      options.globKeyFromRelPath,
    );
    const modulePath = resolvedKey ?? globKey;
    const mod = resolvedKey ? modules[resolvedKey] : undefined;
    if (!mod) continue;

    const index = autoEntries.findIndex(
      (entry) => entry.id === family.root && entry.modulePath === modulePath,
    );
    if (index < 0) continue;

    const compoundEntry = buildCompoundPlaygroundEntryForTarget(
      family,
      targetName,
      mod,
      modulePath,
      report,
      options,
    );
    if (!compoundEntry) continue;

    const existing = autoEntries[index]!;
    autoEntries[index] = {
      ...existing,
      controls: compoundEntry.controls,
      renderPreview: compoundEntry.renderPreview,
      Preview: compoundEntry.Preview,
      usageSnippet: compoundEntry.usageSnippet,
    };
  }
}

/** @internal test helper — map rel_path → playground group from report specs. */
export function playgroundSpecByRelPath(
  specs: PlaygroundSpec[] | undefined,
): Map<string, PlaygroundSpec> {
  const map = new Map<string, PlaygroundSpec>();
  for (const spec of specs ?? []) {
    if (!map.has(spec.rel_path)) map.set(spec.rel_path, spec);
  }
  return map;
}
