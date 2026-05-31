import type { PlaygroundControl } from "../types/controls";
import type { DeclaredPropKind, UsageSummary } from "../types/report";

export const CHILDREN_SLOT_DEFAULT = "Example";

/** Never surfaced as playground controls or preview props. */
export const SKIP_PLAYGROUND_PROPS = new Set(["key", "ref", "props"]);

/** Styling props kept in the panel but without generated placeholder defaults. */
export const PASSTHROUGH_STRING_PROPS = new Set(["className", "style"]);

export function isPassthroughStringProp(key: string): boolean {
  return PASSTHROUGH_STRING_PROPS.has(key);
}

export function stringDefaultForProp(key: string): string {
  if (isPassthroughStringProp(key)) return "";
  return defaultStringForProp(key);
}

export type PlaygroundStringControl = Extract<PlaygroundControl, { type: "string" }>;

/** Parts like BreadcrumbSeparator default to an icon when children is omitted. */
export function usesIconChildrenFallback(exportName: string): boolean {
  return exportName.endsWith("Separator");
}

export function childrenControl(exportName?: string): PlaygroundStringControl {
  if (exportName && usesIconChildrenFallback(exportName)) {
    return {
      key: "children",
      label: "children",
      type: "string",
      default: "",
      placeholder: "Custom separator (chevron when empty)",
    };
  }
  return {
    key: "children",
    label: "children",
    type: "string",
    default: CHILDREN_SLOT_DEFAULT,
    placeholder: "Slot content",
  };
}

export function childrenPropForPreview(
  exportName: string | undefined,
  raw: unknown,
): unknown | undefined {
  if (exportName && usesIconChildrenFallback(exportName)) {
    if (raw === undefined || raw === null || String(raw).length === 0) return undefined;
    return String(raw);
  }
  if (raw === undefined || raw === null) return CHILDREN_SLOT_DEFAULT;
  return String(raw);
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
  exportName?: string,
): PlaygroundControl[] {
  if (!acceptsChildren || controls.some((c) => c.key === "children")) {
    return controls;
  }
  return [...controls, childrenControl(exportName)];
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
  exportName?: string,
): PlaygroundControl[] {
  const out: PlaygroundControl[] = [];
  for (const key of declaredProps) {
    if (SKIP_PLAYGROUND_PROPS.has(key)) continue;
    if (key === "children") {
      out.push(childrenControl(exportName));
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
        default: stringDefaultForProp(key),
        placeholder: isPassthroughStringProp(key) ? undefined : key,
      });
    } else if (isLikelyBooleanProp(key)) {
      out.push({ key, label: key, type: "boolean", default: false });
    } else {
      out.push({
        key,
        label: key,
        type: "string",
        default: stringDefaultForProp(key),
        placeholder: isPassthroughStringProp(key) ? undefined : key,
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
  exportName?: string,
): PlaygroundControl[] {
  const override = controlOverrides[catalogId];
  if (override) return override;
  return controlsFromDeclaredProps(
    declaredProps,
    propKinds,
    propOptions,
    propDefaults,
    exportName,
  );
}
