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
  const x = mod[exportName];
  return isPlaygroundComponent(x) ? x : undefined;
}
