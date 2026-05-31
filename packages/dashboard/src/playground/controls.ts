import type { PlaygroundControl } from "../types/controls";
import type { DeclaredPropKind, UsageSummary } from "../types/report";

export const CHILDREN_SLOT_DEFAULT = "Example";

export type PlaygroundStringControl = Extract<PlaygroundControl, { type: "string" }>;

export function childrenControl(): PlaygroundStringControl {
  return {
    key: "children",
    label: "children",
    type: "string",
    default: CHILDREN_SLOT_DEFAULT,
    placeholder: "Slot content",
  };
}

export function componentAcceptsChildren(
  declaredProps: string[],
  usage?: UsageSummary,
): boolean {
  if (declaredProps.includes("children")) return true;
  if (declaredProps.includes("asChild")) return true;
  if ((usage?.prop_frequencies?.children ?? 0) > 0) return true;
  return false;
}

export function ensureChildrenControl(
  controls: PlaygroundControl[],
  acceptsChildren: boolean,
): PlaygroundControl[] {
  if (!acceptsChildren || controls.some((c) => c.key === "children")) {
    return controls;
  }
  return [...controls, childrenControl()];
}

export function isLikelyBooleanProp(name: string): boolean {
  const n = name.toLowerCase();
  if (n === "disabled" || n === "loading" || n === "aschild") return true;
  if (n.startsWith("is") || n.startsWith("has")) return true;
  if (n.startsWith("show") || n.startsWith("hide")) return true;
  return false;
}

export function defaultStringForProp(key: string): string {
  if (key === "href") return "/governance";
  const k = key.toLowerCase();
  if (
    k === "title" ||
    k === "label" ||
    k === "text" ||
    k === "name" ||
    k === "heading"
  ) {
    return "Label";
  }
  return key;
}

export function controlsFromDeclaredProps(
  declaredProps: string[],
  propKinds?: Partial<Record<string, DeclaredPropKind>>,
  propOptions?: Record<string, string[]>,
  propDefaults?: Record<string, string>,
): PlaygroundControl[] {
  const skip = new Set(["key", "ref"]);
  const out: PlaygroundControl[] = [];
  for (const key of declaredProps) {
    if (skip.has(key)) continue;
    if (key === "children") {
      out.push(childrenControl());
      continue;
    }
    const options = propOptions?.[key];
    if (options && options.length >= 2) {
      const defaultVal =
        propDefaults?.[key] ??
        (options.includes("default") ? "default" : options[0]!);
      out.push({
        key,
        label: key,
        type: "select",
        default: defaultVal,
        options: options.map((value) => ({ value, label: value })),
      });
      continue;
    }
    const kind = propKinds?.[key];
    if (kind === "boolean") {
      out.push({ key, label: key, type: "boolean", default: false });
    } else if (kind === "number") {
      out.push({ key, label: key, type: "number", default: 0 });
    } else if (kind === "string") {
      out.push({
        key,
        label: key,
        type: "string",
        default: defaultStringForProp(key),
        placeholder: key,
      });
    } else if (isLikelyBooleanProp(key)) {
      out.push({ key, label: key, type: "boolean", default: false });
    } else {
      out.push({
        key,
        label: key,
        type: "string",
        default: defaultStringForProp(key),
        placeholder: key,
      });
    }
  }
  return out;
}

export function controlsForSpec(
  catalogId: string,
  declaredProps: string[],
  propKinds: Partial<Record<string, DeclaredPropKind>> | undefined,
  propOptions: Record<string, string[]> | undefined,
  propDefaults: Record<string, string> | undefined,
  controlOverrides: Record<string, PlaygroundControl[]>,
): PlaygroundControl[] {
  const override = controlOverrides[catalogId];
  if (override) return override;
  return controlsFromDeclaredProps(
    declaredProps,
    propKinds,
    propOptions,
    propDefaults,
  );
}
