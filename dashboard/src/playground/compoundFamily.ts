import type {
  ComponentDefinition,
  DefinitionKind,
  ExampleNode,
  WorkspaceReport,
} from "../types/report";
import { fileStemFromRelPath, relPathFromAbsolute } from "./pathUtils";
import { findPlaygroundSpecByRelPath } from "./reportQueries";
import { shouldUseExampleTreePreview } from "./shouldUseExampleTreePreview";

const PLAYABLE_KINDS = new Set<DefinitionKind>([
  "function",
  "class",
  "const_arrow",
  "const_function",
  "wrapped_component",
]);

const CONTENT_SUFFIXES = ["Menu", "Content", "Panel", "Body", "Viewport"] as const;

/** A stem-rooted compound component family in one module (`Dropdown` + parts). */
export type CompoundFamily = {
  relPath: string;
  group?: string;
  root: string;
  trigger?: string;
  content?: string;
  /** Playable export name → definition (first wins on duplicates). */
  exports: Map<string, ComponentDefinition>;
};

function isPlayableDefinition(definition: ComponentDefinition): boolean {
  return PLAYABLE_KINDS.has(definition.kind);
}

/** `Dropdown-Menu.playground` → `dropdownmenu`. */
function normalizedComponentName(value: string): string {
  return value
    .replace(/\.playground$/i, "")
    .replace(/[-_]/g, "")
    .toLowerCase();
}

/** Group playable definitions by scanner `rel_path`. */
export function groupPlayableDefinitionsByFile(
  report: WorkspaceReport,
): Map<string, Map<string, ComponentDefinition>> {
  const byFile = new Map<string, Map<string, ComponentDefinition>>();

  for (const file of report.files ?? []) {
    const relPath = relPathFromAbsolute(file.path, report.root);
    for (const definition of file.definitions ?? []) {
      if (!isPlayableDefinition(definition)) continue;

      let exports = byFile.get(relPath);
      if (!exports) {
        exports = new Map();
        byFile.set(relPath, exports);
      }
      if (!exports.has(definition.name)) exports.set(definition.name, definition);
    }
  }

  return byFile;
}

function findTriggerExport(root: string, names: Iterable<string>): string | undefined {
  const list = [...names];
  const preferred = `${root}Trigger`;
  if (list.includes(preferred)) return preferred;
  return list.find((name) => name !== root && name.endsWith("Trigger"));
}

function findContentExport(
  root: string,
  trigger: string | undefined,
  names: Iterable<string>,
): string | undefined {
  const candidates = [...names].filter((name) => name !== root && name !== trigger);

  for (const suffix of CONTENT_SUFFIXES) {
    const preferred = `${root}${suffix}`;
    if (candidates.includes(preferred)) return preferred;
  }

  return candidates.find((name) => CONTENT_SUFFIXES.some((suffix) => name.endsWith(suffix)));
}

/** Detect a stem-rooted compound component family in one module. */
export function detectCompoundFamily(
  relPath: string,
  exports: Map<string, ComponentDefinition>,
  group?: string,
): CompoundFamily | null {
  if (exports.size < 2) return null;

  const stem = fileStemFromRelPath(relPath);
  const root = [...exports.keys()].find(
    (name) => normalizedComponentName(name) === normalizedComponentName(stem),
  );
  if (!root) return null;

  const names = [...exports.keys()];
  const trigger = findTriggerExport(root, names);
  const content = findContentExport(root, trigger, names);

  return { relPath, group, root, trigger, content, exports };
}

function playgroundGroupForFile(report: WorkspaceReport, relPath: string): string | undefined {
  return findPlaygroundSpecByRelPath(report, relPath)?.group ?? undefined;
}

/** Usage-derived composition for preview when the heuristic says a tree beats live render. */
export function familyExampleTree(
  report: WorkspaceReport,
  family: CompoundFamily,
): ExampleNode | undefined {
  const spec = findPlaygroundSpecByRelPath(report, family.relPath);
  if (!spec || spec.export_name !== family.root) return undefined;
  const tree = spec.example_tree;
  if (!tree) return undefined;
  return shouldUseExampleTreePreview(spec, tree, report) ? tree : undefined;
}

/** All compound families in a workspace report. */
export function findCompoundFamilies(report: WorkspaceReport): CompoundFamily[] {
  const families: CompoundFamily[] = [];
  for (const [relPath, exports] of groupPlayableDefinitionsByFile(report)) {
    const family = detectCompoundFamily(relPath, exports, playgroundGroupForFile(report, relPath));
    if (family) families.push(family);
  }
  return families;
}

/** Primary preview target for a compound family (content, then trigger). */
export function primaryCompoundTarget(family: CompoundFamily): string | undefined {
  return family.content ?? family.trigger;
}
