import { createElement, type ComponentType, type ReactNode } from "react";
import type { ExampleNode, ExampleValue } from "../types/report";
import { isPlaygroundComponent } from "./playgroundModuleExport";
import { formatJsxPropAssignment } from "./snippet";

type ExampleModules = Record<string, Record<string, unknown>>;

type ResolvedComponent = ComponentType<Record<string, unknown>> | string;

/** Maps an `ExampleNode` element name to a renderable component or intrinsic tag. */
export type ExampleComponentResolver = (name: string) => ResolvedComponent | undefined;

function isIntrinsicName(name: string): boolean {
  const first = name.charAt(0);
  return first.length > 0 && first === first.toLowerCase();
}

function lookupExport(mod: Record<string, unknown>, name: string): unknown {
  // Member names (`Stack.Item`) walk properties from the root export.
  const [root, ...rest] = name.split(".");
  let value: unknown = mod[root!];
  for (const part of rest) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

/**
 * Resolve element names from the component's own module first, then any other
 * scanned module (cross-file compositions). Intrinsic tags pass through.
 */
export function createExampleComponentResolver(
  primaryModule: Record<string, unknown> | undefined,
  modules: ExampleModules,
): ExampleComponentResolver {
  const cache = new Map<string, ResolvedComponent | undefined>();
  return (name: string) => {
    if (isIntrinsicName(name)) return name;
    if (cache.has(name)) return cache.get(name);

    let resolved: ResolvedComponent | undefined;
    if (primaryModule) {
      const value = lookupExport(primaryModule, name);
      if (isPlaygroundComponent(value)) resolved = value;
    }
    if (!resolved) {
      for (const mod of Object.values(modules)) {
        if (!mod || typeof mod !== "object" || mod === primaryModule) continue;
        const value = lookupExport(mod, name);
        if (isPlaygroundComponent(value)) {
          resolved = value;
          break;
        }
      }
    }
    cache.set(name, resolved);
    return resolved;
  };
}

function exampleValueToProp(value: ExampleValue): unknown {
  return value.value;
}

function propsFromNode(props: Record<string, ExampleValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props ?? {})) {
    out[key] = exampleValueToProp(value);
  }
  return out;
}

/** Fallback tag for elements the module map cannot resolve (e.g. router `Link`). */
function degradedIntrinsicFor(
  props: Record<string, unknown>,
  hasChildren: boolean,
): string | undefined {
  if (typeof props.href === "string") return "a";
  return hasChildren ? "span" : undefined;
}

export type RenderExampleTreeOptions = {
  /** Merged into the root element's props (playground control values win). */
  rootProps?: Record<string, unknown>;
  /** Merged into the first element matching `name` (sub-export controls). */
  target?: { name: string; props: Record<string, unknown> };
};

type RenderState = {
  resolve: ExampleComponentResolver;
  target?: { name: string; props: Record<string, unknown>; applied: boolean };
};

function renderNode(
  node: ExampleNode,
  state: RenderState,
  key: string,
  overrideProps?: Record<string, unknown>,
): ReactNode {
  if (node.type === "text") return node.value;
  if (node.type === "placeholder") return node.hint;

  let props = propsFromNode(node.props);
  if (overrideProps) props = { ...props, ...overrideProps };
  if (state.target && !state.target.applied && node.name === state.target.name) {
    state.target.applied = true;
    props = { ...props, ...state.target.props };
  }

  const children = (node.children ?? []).map((child, i) => renderNode(child, state, `${key}.${i}`));
  const hasChildren = children.length > 0;

  let type = state.resolve(node.name);
  if (type === undefined) {
    type = degradedIntrinsicFor(props, hasChildren);
    if (type === undefined) return null;
    // Unknown component props (asChild, custom callbacks) would leak onto a DOM
    // node — keep only safe passthrough attributes.
    props = pickDomSafeProps(props, type);
  }

  return hasChildren
    ? createElement(type, { ...props, key }, ...children)
    : createElement(type, { ...props, key });
}

const DOM_SAFE_PROPS = new Set(["className", "style", "id", "title", "role"]);

function pickDomSafeProps(props: Record<string, unknown>, tag: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (DOM_SAFE_PROPS.has(key) || key.startsWith("aria-") || key.startsWith("data-")) {
      out[key] = value;
    }
  }
  if (tag === "a" && typeof props.href === "string") out.href = props.href;
  return out;
}

/** Replay a scanner-captured example tree with `createElement`. */
export function renderExampleTree(
  tree: ExampleNode,
  resolve: ExampleComponentResolver,
  options: RenderExampleTreeOptions = {},
): ReactNode {
  const state: RenderState = {
    resolve,
    target: options.target ? { ...options.target, applied: false } : undefined,
  };
  return renderNode(tree, state, "example", options.rootProps);
}

/** True when `tree` contains an element named `name` (root included). */
export function exampleTreeContainsElement(tree: ExampleNode, name: string): boolean {
  if (tree.type !== "element") return false;
  if (tree.name === name) return true;
  return (tree.children ?? []).some((child) => exampleTreeContainsElement(child, name));
}

function snippetProps(
  props: Record<string, ExampleValue> | undefined,
  overrides?: Record<string, unknown>,
): string {
  const merged: Record<string, unknown> = propsFromNode(props);
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined || value === "" || value === false) {
      delete merged[key];
      continue;
    }
    merged[key] = value;
  }
  return Object.entries(merged)
    .map(([key, value]) => formatJsxPropAssignment(key, value))
    .join(" ");
}

function snippetLines(
  node: ExampleNode,
  state: { target?: { name: string; props: Record<string, unknown>; applied: boolean } },
  indent: string,
  rootProps?: Record<string, unknown>,
): string[] {
  if (node.type === "text") return [`${indent}${node.value}`];
  if (node.type === "placeholder") return [`${indent}${node.hint}`];

  let overrides = rootProps;
  if (state.target && !state.target.applied && node.name === state.target.name) {
    state.target.applied = true;
    overrides = { ...overrides, ...state.target.props };
  }
  const propsStr = snippetProps(node.props, overrides);
  const open = propsStr.length > 0 ? `<${node.name} ${propsStr}` : `<${node.name}`;

  const children = node.children ?? [];
  if (children.length === 0) return [`${indent}${open} />`];

  if (children.length === 1 && children[0]!.type !== "element") {
    const only = children[0]!;
    const text = only.type === "text" ? only.value : only.hint;
    return [`${indent}${open}>${text}</${node.name}>`];
  }

  const lines = [`${indent}${open}>`];
  for (const child of children) {
    lines.push(...snippetLines(child, state, `${indent}  `));
  }
  lines.push(`${indent}</${node.name}>`);
  return lines;
}

/** JSX-ish usage snippet mirroring the rendered example tree. */
export function exampleTreeSnippet(
  tree: ExampleNode,
  options: RenderExampleTreeOptions = {},
): string {
  const state = {
    target: options.target ? { ...options.target, applied: false } : undefined,
  };
  return snippetLines(tree, state, "", options.rootProps).join("\n");
}
