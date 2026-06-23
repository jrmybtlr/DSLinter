import type { CssTokenDefinition } from "../types/report";

/** Expand `#abc` → `#aabbcc` (lowercase). */
export function normalizeHex(raw: string): string | null {
  const s = raw.trim().replace(/^#/, "");
  if (s.length === 3 && /^[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toLowerCase();
  }
  if (s.length === 6 && /^[0-9a-fA-F]{6}$/.test(s)) {
    return `#${s}`.toLowerCase();
  }
  return null;
}

/** Parse hex or `rgb()`/`rgba()` into normalized `#rrggbb`. */
export function parseCssColor(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith("#")) {
    return normalizeHex(trimmed);
  }
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const [, r, g, b] = rgb;
    const toHex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${toHex(r!)}${toHex(g!)}${toHex(b!)}`;
  }
  return null;
}

const VAR_REF_RE = /var\(\s*(--[a-zA-Z0-9][a-zA-Z0-9_-]*)/;
const MAX_VAR_DEPTH = 8;

function resolveTokenValue(
  value: string,
  varMap: Map<string, string>,
  depth = 0,
): string | null {
  if (depth > MAX_VAR_DEPTH) return null;
  const trimmed = value.trim();
  const varMatch = trimmed.match(VAR_REF_RE);
  if (varMatch?.[1]) {
    const next = varMap.get(varMatch[1]);
    if (!next) return null;
    return resolveTokenValue(next, varMap, depth + 1);
  }
  return trimmed;
}

/** Find a color token whose resolved value equals the given hex (after normalization). */
export function findColorTokenForHex(
  definitions: CssTokenDefinition[] | undefined,
  hex: string,
): CssTokenDefinition | undefined {
  const target = parseCssColor(hex);
  if (!target || !definitions?.length) return undefined;

  const varMap = new Map(definitions.map((d) => [d.name, d.value]));

  const matches = definitions.filter((def) => {
    if (def.category !== "color") return false;
    const resolved = resolveTokenValue(def.value, varMap);
    if (!resolved) return false;
    return parseCssColor(resolved) === target;
  });

  if (matches.length === 0) return undefined;

  return matches.sort((a, b) => {
    const aPref = a.name.startsWith("--color-") ? 0 : 1;
    const bPref = b.name.startsWith("--color-") ? 0 : 1;
    return aPref - bPref;
  })[0];
}
