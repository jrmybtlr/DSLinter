import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import { isNonEditableControl } from "../types/controls";
import type { DeclaredPropKind, PlaygroundSpec } from "../types/report";
import {
  childrenPropForPreview,
  isLikelyBooleanProp,
  isLikelyStringArrayProp,
  isPassthroughStringProp,
  resolveEffectivePropKind,
  SKIP_PLAYGROUND_PROPS,
} from "./controls";

export function coerceDeclaredPropKind(v: unknown): DeclaredPropKind | undefined {
  if (
    v === "boolean" ||
    v === "string" ||
    v === "number" ||
    v === "node" ||
    v === "stringArray" ||
    v === "numberArray" ||
    v === "function" ||
    v === "icon" ||
    v === "object" ||
    v === "unknown"
  ) {
    return v;
  }
  return undefined;
}

export function normalizedPropKinds(
  raw: PlaygroundSpec["declared_prop_kinds"],
): Partial<Record<string, DeclaredPropKind>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<Record<string, DeclaredPropKind>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const ck = coerceDeclaredPropKind(v);
    if (ck && ck !== "unknown") out[k] = ck;
  }
  return Object.keys(out).length ? out : undefined;
}

export function parseStringArrayPanelValue(raw: unknown): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
}

export function parseNumberArrayPanelValue(raw: unknown): number[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const line of text.split(/\r?\n/)) {
    const n = Number(line.trim());
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function propKeysForPreview(controls: PlaygroundControl[], declaredProps: string[]): string[] {
  if (controls.length > 0) {
    return controls.filter((c) => !isNonEditableControl(c)).map((c) => c.key);
  }
  return declaredProps.filter((k) => k !== "key" && k !== "ref");
}

export function valuesToComponentProps(
  controls: PlaygroundControl[],
  declaredProps: string[],
  values: PlaygroundArgs,
  propKinds?: Partial<Record<string, DeclaredPropKind>>,
  exportName?: string,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const key of propKeysForPreview(controls, declaredProps)) {
    if (SKIP_PLAYGROUND_PROPS.has(key)) continue;
    if (isPassthroughStringProp(key)) {
      const raw = values[key];
      if (raw === undefined || raw === null || String(raw).length === 0) continue;
      o[key] = String(raw);
      continue;
    }
    if (key === "children") {
      const coerced = childrenPropForPreview(exportName, values.children);
      if (coerced !== undefined) o[key] = coerced;
      continue;
    }
    const kind = resolveEffectivePropKind(key, propKinds);
    if (kind === "function" || kind === "icon" || kind === "object") {
      continue;
    }
    if (kind === "boolean") {
      o[key] = Boolean(values[key]);
      continue;
    }
    if (kind === "number") {
      const raw = values[key];
      const n = typeof raw === "number" ? raw : Number(raw);
      o[key] = Number.isFinite(n) ? n : 0;
      continue;
    }
    if (kind === "stringArray") {
      o[key] = parseStringArrayPanelValue(values[key]);
      continue;
    }
    if (kind === "numberArray") {
      o[key] = parseNumberArrayPanelValue(values[key]);
      continue;
    }
    if (kind === "string" || kind === "node") {
      o[key] = values[key];
      continue;
    }
    if (isLikelyBooleanProp(key)) {
      o[key] = Boolean(values[key]);
      continue;
    }
    if (isLikelyStringArrayProp(key)) {
      o[key] = parseStringArrayPanelValue(values[key]);
      continue;
    }
    // Unclassified without a control kind: do not invent values.
    continue;
  }
  return o;
}

export function mergeStaticDefaults(
  fromValues: Record<string, unknown>,
  staticDefaults: Record<string, unknown>,
): Record<string, unknown> {
  const o = { ...fromValues };
  for (const [k, v] of Object.entries(staticDefaults)) {
    const cur = o[k];
    if (cur === undefined || (cur === "" && k !== "children")) o[k] = v;
  }
  return o;
}
