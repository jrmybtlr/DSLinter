import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type { DeclaredPropKind, PlaygroundSpec } from "../types/report";
import { CHILDREN_SLOT_DEFAULT, isLikelyBooleanProp } from "./controls";

export function coerceDeclaredPropKind(v: unknown): DeclaredPropKind | undefined {
  if (v === "boolean" || v === "string" || v === "number" || v === "unknown")
    return v;
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
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const key of propKeysForPreview(controls, declaredProps)) {
    if (key === "key" || key === "ref") continue;
    if (key === "children") {
      const v = values.children;
      o[key] =
        v !== undefined && v !== null && String(v).length > 0
          ? String(v)
          : CHILDREN_SLOT_DEFAULT;
      continue;
    }
    const kind = propKinds?.[key];
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
    if (kind === "string") {
      o[key] = values[key];
      continue;
    }
    if (isLikelyBooleanProp(key)) {
      o[key] = Boolean(values[key]);
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
    if (cur === undefined || cur === "") o[k] = v;
  }
  return o;
}
