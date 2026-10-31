import { createElement, type ReactNode } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type { CompoundFamily } from "./compoundFamily";
import { getModuleExport } from "./playgroundModuleExport";
import { formatJsxPropAssignment } from "./snippet";

function placeholderPartChildren(exportName: string): ReactNode {
  if (exportName.endsWith("Separator")) return null;
  if (exportName.endsWith("Header") || exportName.endsWith("Label")) return "Section";
  if (exportName.includes("Item") || exportName.endsWith("Action")) return "Example item";
  return "Example";
}

function demoMenuChildren(
  family: CompoundFamily,
  mod: Record<string, unknown>,
  targetName: string,
): ReactNode {
  const itemExport = [...family.exports.keys()].find(
    (name) => name.endsWith("Item") && name !== targetName,
  );
  const separatorExport = [...family.exports.keys()].find((name) => name.endsWith("Separator"));

  const nodes: ReactNode[] = [];

  if (targetName !== family.content) {
    const Target = getModuleExport(mod, targetName);
    if (Target) {
      nodes.push(createElement(Target, null, placeholderPartChildren(targetName)));
    }
  }

  if (itemExport && targetName !== itemExport) {
    const Item = getModuleExport(mod, itemExport);
    if (Item) nodes.push(createElement(Item, null, "Example item"));
  }
  if (separatorExport && targetName !== separatorExport && nodes.length > 0) {
    const Separator = getModuleExport(mod, separatorExport);
    if (Separator) nodes.push(createElement(Separator));
  }
  if (itemExport && targetName !== itemExport && nodes.length > 1) {
    const Item = getModuleExport(mod, itemExport);
    if (Item) nodes.push(createElement(Item, null, "Another item"));
  }

  return nodes.length > 0 ? nodes : placeholderPartChildren(targetName);
}

/** Compose a sub-export inside its root/trigger/content context. */
export function renderCompoundPreview(
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

/** Usage snippet for a sub-export, mirroring {@link renderCompoundPreview}. */
export function compoundUsageSnippet(
  family: CompoundFamily,
  targetName: string,
  values: PlaygroundArgs,
  controls: PlaygroundControl[],
): string {
  const propsStr = controls
    .filter((control) => control.key !== "children")
    .map((control) => formatJsxPropAssignment(control.key, values[control.key]))
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
