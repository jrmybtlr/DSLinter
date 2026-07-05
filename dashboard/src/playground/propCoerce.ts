import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
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

function propKeysForPreview(
  controls: PlaygroundControl[],
  declaredProps: string[],
): string[] {
  if (controls.length > 0) return controls.map((c) => c.key);
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
    o[key] = values[key];
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
