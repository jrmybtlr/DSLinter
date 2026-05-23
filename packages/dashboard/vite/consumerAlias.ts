import { isAbsolute, join, resolve } from "node:path";
import type { Alias, AliasOptions } from "vite";

export type FlatAlias = {
  find: string | RegExp;
  replacement: string;
};

function normalizeFind(find: string | RegExp): string | RegExp {
  if (typeof find !== "string") return find;
  if (find.endsWith("/") && !find.includes("*")) {
    return find.slice(0, -1);
  }
  return find;
}

/**
 * Flatten Vite `resolve.alias` for use in a custom resolveId hook.
 */
export function flattenViteAlias(
  alias: AliasOptions | undefined,
  consumerRoot: string,
): FlatAlias[] {
  if (!alias) return [];
  const root = resolve(consumerRoot);
  const out: FlatAlias[] = [];

  const push = (find: string | RegExp, replacement: string) => {
    const rep = isAbsolute(replacement)
      ? replacement
      : resolve(root, replacement);
    out.push({ find: normalizeFind(find), replacement: rep });
  };

  if (Array.isArray(alias)) {
    for (const entry of alias) {
      if (typeof entry === "object" && entry !== null && "find" in entry) {
        const e = entry as Alias;
        push(e.find, String(e.replacement));
      }
    }
    return out.sort((a, b) => {
      const al = typeof a.find === "string" ? a.find.length : 0;
      const bl = typeof b.find === "string" ? b.find.length : 0;
      return bl - al;
    });
  }

  for (const [find, replacement] of Object.entries(alias)) {
    push(find, String(replacement));
  }
  return out.sort((a, b) => {
    const al = typeof a.find === "string" ? a.find.length : 0;
    const bl = typeof b.find === "string" ? b.find.length : 0;
    return bl - al;
  });
}

/**
 * Resolve `id` using consumer aliases (longest prefix first for strings).
 */
export function resolveWithConsumerAliases(
  id: string,
  aliases: FlatAlias[],
): string | null {
  for (const { find, replacement } of aliases) {
    if (typeof find === "string") {
      if (find.endsWith("/")) {
        if (id.startsWith(find)) {
          const sub = id.slice(find.length);
          return join(replacement, sub);
        }
        const findNoSlash = find.slice(0, -1);
        if (id === findNoSlash || id.startsWith(`${findNoSlash}/`)) {
          const sub = id === findNoSlash ? "" : id.slice(findNoSlash.length + 1);
          return sub ? join(replacement, sub) : replacement;
        }
      } else if (id === find) {
        return replacement;
      } else if (id.startsWith(`${find}/`)) {
        const sub = id.slice(find.length + 1);
        return join(replacement, sub);
      }
    } else {
      const m = id.match(find);
      if (m) {
        return id.replace(find, replacement);
      }
    }
  }
  return null;
}

/** True when `importer` is a file under `scanRoot`. */
export function importerUnderScanRoot(
  importer: string | undefined,
  scanRoot: string,
): boolean {
  if (!importer || importer === "\0virtual") return false;
  const root = resolve(scanRoot).replace(/\\/g, "/");
  const norm = importer.replace(/\\/g, "/");
  const rootWithSlash = root.endsWith("/") ? root : `${root}/`;
  return norm === root || norm.startsWith(rootWithSlash);
}

export const INERTIA_SHIM_IDS = new Set([
  "@inertiajs/react",
  "@inertiajs/react/server",
]);

export const ZIGGY_SHIM_ID = "ziggy-js";
