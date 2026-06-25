import type { ComponentType } from "react";

/** True for function components and exotic types (forwardRef, memo). */
export function isPlaygroundComponent(value: unknown): value is ComponentType<
  Record<string, unknown>
> {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return typeof o.render === "function" || typeof o.$$typeof === "symbol";
}

export function getModuleExport(
  mod: Record<string, unknown>,
  exportName: string,
): ComponentType<Record<string, unknown>> | undefined {
  const named = mod[exportName];
  if (isPlaygroundComponent(named)) return named;
  const fallback = mod.default;
  if (isPlaygroundComponent(fallback)) return fallback;
  return undefined;
}
