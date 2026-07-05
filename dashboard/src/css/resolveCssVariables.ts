import type { CssTokenDefinition } from "../types/report";

const VAR_REF_RE = /var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,[^)]+)?\s*\)/g;

export function resolveCssVariables(
  vars: Map<string, string>,
): Record<string, string> {
  const resolved = new Map<string, string>();

  const resolveOne = (name: string, seen: Set<string>): string => {
    const cached = resolved.get(name);
    if (cached != null) return cached;

    const raw = vars.get(name);
    if (raw == null) return `var(${name})`;
    if (seen.has(name)) return raw;

    seen.add(name);
    const next = raw.replace(VAR_REF_RE, (_match, ref: string) => {
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
  const vars = variableMapForScopes(
    definitions,
    new Set(["root", "theme"]),
    predicate,
  );
  return resolveCssVariables(vars);
}
