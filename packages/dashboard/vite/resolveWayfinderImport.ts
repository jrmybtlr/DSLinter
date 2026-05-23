import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveWithConsumerAliases, type FlatAlias } from "./consumerAlias";

const FILE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"] as const;

export const WAYFINDER_ROUTES_PREFIX = "@/routes";
export const WAYFINDER_ACTIONS_PREFIX = "@/actions";

export function isWayfinderRoutesImport(id: string): boolean {
  return id === WAYFINDER_ROUTES_PREFIX || id.startsWith(`${WAYFINDER_ROUTES_PREFIX}/`);
}

export function isWayfinderActionsImport(id: string): boolean {
  return id === WAYFINDER_ACTIONS_PREFIX || id.startsWith(`${WAYFINDER_ACTIONS_PREFIX}/`);
}

/** Resolve import to an existing file on disk, trying common extensions. */
export function resolveExistingModule(
  id: string,
  aliases: FlatAlias[],
): string | null {
  const base = resolveWithConsumerAliases(id, aliases);
  if (!base) return null;

  if (existsSync(base)) {
    try {
      if (!statSync(base).isDirectory()) return base;
    } catch {
      return null;
    }
  }

  for (const ext of FILE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (existsSync(candidate)) return candidate;
  }

  for (const ext of FILE_EXTENSIONS) {
    const candidate = join(base, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

/** When Wayfinder output is missing, map @/routes/* and @/actions/* to dslinter shims. */
export function resolveWayfinderShim(
  id: string,
  routesShimPath: string,
  actionsShimPath: string,
): string | null {
  if (isWayfinderRoutesImport(id)) return routesShimPath;
  if (isWayfinderActionsImport(id)) return actionsShimPath;
  return null;
}
