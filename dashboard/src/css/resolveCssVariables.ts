import type { CssTokenDefinition } from "../types/report";

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
}

function isIdentChar(code: number): boolean {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 95 ||
    code === 45
  );
}

/** Parse `var(--name)` or `var(--name, fallback)` starting at `start`. */
function parseVarFunction(value: string, start: number): { name: string; end: number } | null {
  if (!value.startsWith("var(", start)) return null;

  let i = start + 4;
  while (i < value.length && isWhitespace(value[i]!)) i += 1;

  if (value[i] !== "-" || value[i + 1] !== "-") return null;

  const nameStart = i;
  i += 2;
  while (i < value.length && isIdentChar(value.charCodeAt(i))) i += 1;

  const name = value.slice(nameStart, i);
  if (name.length < 3) return null;

  while (i < value.length && isWhitespace(value[i]!)) i += 1;

  let depth = 1;
  if (i < value.length && value[i] === ",") {
    i += 1;
  }

  while (i < value.length && depth > 0) {
    const ch = value[i]!;
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    i += 1;
  }

  if (depth !== 0) return null;
  return { name, end: i };
}

function substituteVarReferences(value: string, resolveRef: (name: string) => string): string {
  let out = "";
  let i = 0;

  while (i < value.length) {
    const parsed = parseVarFunction(value, i);
    if (parsed) {
      out += resolveRef(parsed.name);
      i = parsed.end;
      continue;
    }
    out += value[i]!;
    i += 1;
  }

  return out;
}

export function resolveCssVariables(vars: Map<string, string>): Record<string, string> {
  const resolved = new Map<string, string>();

  const resolveOne = (name: string, seen: Set<string>): string => {
    const cached = resolved.get(name);
    if (cached != null) return cached;

    const raw = vars.get(name);
    if (raw == null) return `var(${name})`;
    if (seen.has(name)) return raw;

    seen.add(name);
    const next = substituteVarReferences(raw, (ref) => {
      if (!vars.has(ref)) return `var(${ref})`;
      return resolveOne(ref, seen);
    });
    seen.delete(name);
    resolved.set(name, next);
    return next;
  };

  for (const name of vars.keys()) {
    resolveOne(name, new Set());
  }

  return Object.fromEntries(resolved);
}

export function variableMapForScopes(
  definitions: CssTokenDefinition[],
  scopes: ReadonlySet<CssTokenDefinition["scope"]>,
  predicate?: (def: CssTokenDefinition) => boolean,
): Map<string, string> {
  const vars = new Map<string, string>();
  for (const def of definitions) {
    if (!scopes.has(def.scope)) continue;
    if (predicate && !predicate(def)) continue;
    if (!vars.has(def.name)) {
      vars.set(def.name, def.value);
    }
  }
  return vars;
}

/** Resolved light-mode token values (root + @theme), optionally scoped to consumer CSS. */
export function resolveLightTokenValues(
  definitions: CssTokenDefinition[],
  predicate?: (def: CssTokenDefinition) => boolean,
): Record<string, string> {
  const vars = variableMapForScopes(definitions, new Set(["root", "theme"]), predicate);
  return resolveCssVariables(vars);
}
