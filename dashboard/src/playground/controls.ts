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
export type PlaygroundNodeControl = Extract<PlaygroundControl, { type: "node" }>;

/** Parts like BreadcrumbSeparator default to an icon when children is omitted. */
export function usesIconChildrenFallback(exportName: string): boolean {
  return exportName.endsWith("Separator");
}

export function childrenControl(exportName?: string): PlaygroundNodeControl {
  if (exportName && usesIconChildrenFallback(exportName)) {
    return {
      key: "children",
      label: "children",
      type: "node",
      default: "",
      placeholder: "Custom separator (chevron when empty)",
    };
  }
  return {
    key: "children",
    label: "children",
    type: "node",
    default: CHILDREN_SLOT_DEFAULT,
    placeholder: "Slot content",
  };
}

export function nodeControlForProp(key: string): PlaygroundNodeControl {
  return {
    key,
    label: key,
    type: "node",
    default: defaultStringForProp(key),
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

export function isLikelyStringArrayProp(name: string): boolean {
  const n = name.toLowerCase();
  if (n === "errors" || n === "messages" || n === "items" || n === "tags") {
    return true;
  }
  return n.endsWith("list");
}

export function resolveEffectivePropKind(
  key: string,
  propKinds?: Partial<Record<string, DeclaredPropKind>>,
): DeclaredPropKind | undefined {
  const kind = propKinds?.[key];
  if (kind && kind !== "unknown") return kind;
  if (isLikelyStringArrayProp(key)) return "stringArray";
  return kind;
}

export function stringArrayDefaultForProp(key: string): string {
  const k = key.toLowerCase();
  if (k === "errors" || k === "messages") return "Something went wrong.";
  return "First item\nSecond item";
}

export function stringArrayControlForProp(key: string): PlaygroundStringControl {
  return {
    key,
    label: key,
    type: "string",
    default: stringArrayDefaultForProp(key),
    placeholder: "One item per line",
    hint: "Enter multiple values on separate lines",
  };
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
    const kind = resolveEffectivePropKind(key, propKinds);
    if (kind === "boolean") {
      out.push({ key, label: key, type: "boolean", default: false });
    } else if (kind === "number") {
      out.push({ key, label: key, type: "number", default: 0 });
    } else if (kind === "node") {
      out.push(nodeControlForProp(key));
    } else if (kind === "stringArray") {
      out.push(stringArrayControlForProp(key));
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

/** Merge hardcoded control overrides with report-derived controls (report options win). */
export function mergeControlOverrides(
  fromReport: PlaygroundControl[],
  override: PlaygroundControl[] | undefined,
): PlaygroundControl[] {
  if (!override) return fromReport;

  const byKey = new Map(fromReport.map((c) => [c.key, c]));
  const merged: PlaygroundControl[] = [];
  const seen = new Set<string>();

  for (const ctrl of override) {
    seen.add(ctrl.key);
    const reportCtrl = byKey.get(ctrl.key);
    if (
      reportCtrl &&
      reportCtrl.type === "select" &&
      ctrl.type === "select" &&
      reportCtrl.options.length > 0
    ) {
      const optionValues = new Set(reportCtrl.options.map((o) => o.value));
      const defaultVal =
        typeof ctrl.default === "string" && optionValues.has(ctrl.default)
          ? ctrl.default
          : reportCtrl.default;
      merged.push({ ...reportCtrl, default: defaultVal });
      continue;
    }
    if (ctrl.type === "select" && ctrl.options.length === 0) {
      if (reportCtrl) merged.push(reportCtrl);
      continue;
    }
    if (reportCtrl && ctrl.type === reportCtrl.type) {
      merged.push({
        ...reportCtrl,
        default: ctrl.default as never,
        ...(ctrl.type === "string" || ctrl.type === "node"
          ? {
              placeholder:
                "placeholder" in ctrl ? ctrl.placeholder : undefined,
            }
          : {}),
      } as PlaygroundControl);
      continue;
    }
    merged.push(ctrl);
  }

  for (const ctrl of fromReport) {
    if (!seen.has(ctrl.key)) merged.push(ctrl);
  }
  return merged;
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
  const fromReport = controlsFromDeclaredProps(
    declaredProps,
    propKinds,
    propOptions,
    propDefaults,
    exportName,
  );
  return mergeControlOverrides(fromReport, controlOverrides[catalogId]);
}
