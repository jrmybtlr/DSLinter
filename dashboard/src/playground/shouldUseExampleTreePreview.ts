import type { ExampleNode, PlaygroundSpec, WorkspaceReport } from "../types/report";
import { exampleTreeContainsElement } from "./renderExampleTree";

function hasCvaControls(spec: PlaygroundSpec): boolean {
  const options = spec.declared_prop_options ?? {};
  return Object.keys(options).length > 0;
}

function isPascalComponentName(name: string): boolean {
  return name.length > 0 && name.charAt(0) === name.charAt(0).toUpperCase();
}

/** PascalCase element names nested under `rootName` (root excluded). */
export function nestedComponentNamesInTree(tree: ExampleNode, rootName: string): string[] {
  const out: string[] = [];
  const walk = (node: ExampleNode, underRoot: boolean) => {
    if (node.type !== "element") return;
    if (underRoot && node.name !== rootName && isPascalComponentName(node.name)) {
      out.push(node.name);
    }
    const nextUnderRoot = underRoot || node.name === rootName;
    for (const child of node.children ?? []) walk(child, nextUnderRoot);
  };
  walk(tree, tree.type === "element" && tree.name === rootName);
  return out;
}

export function isExportDefinedInFile(
  report: WorkspaceReport | null | undefined,
  relPath: string,
  exportName: string,
): boolean {
  if (!report) return false;
  const file = report.files.find((f) => f.path.replace(/\\/g, "/").endsWith(relPath));
  return (file?.definitions ?? []).some((def) => def.name === exportName);
}

/**
 * Usage-derived example tree vs live `createElement(export)`.
 *
 * Live wins for CVA leaf components whose captured tree is only external composition
 * (Button in nav with Avatar). Tree wins for compound kits defined in same module
 * (Breadcrumb, Alert).
 */
export function shouldUseExampleTreePreview(
  spec: PlaygroundSpec,
  exampleTree: ExampleNode | undefined,
  report: WorkspaceReport | null | undefined,
): exampleTree is ExampleNode {
  if (!exampleTree) return false;
  if (exampleTree.type === "element" && exampleTree.name !== spec.export_name) return true;

  const nested = nestedComponentNamesInTree(exampleTree, spec.export_name);
  if (nested.length === 0) return false;

  if (!hasCvaControls(spec)) return true;

  const sameModuleNested = nested.filter((name) =>
    isExportDefinedInFile(report, spec.rel_path, name),
  );
  if (sameModuleNested.length === 0) return false;

  // Same-file kit (Alert + AlertTitle) — tree even with CVA on root.
  return sameModuleNested.some((name) => exampleTreeContainsElement(exampleTree, name));
}
