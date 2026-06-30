import type { CompactPlaygroundControl } from "./expandPlaygroundControls";

export type InferredKitParam = {
  key: string;
  defaultValue?: CompactPlaygroundControl;
};

function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let start = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (quote) {
      if (ch === quote && input[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") depth += 1;
    else if (ch === "}" || ch === "]" || ch === ")") depth -= 1;
    else if (ch === "," && depth === 0) {
      parts.push(input.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(input.slice(start));
  return parts;
}

function parseLiteral(raw: string): CompactPlaygroundControl | undefined {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  const quoted =
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("`") && value.endsWith("`"));
  if (quoted && value.length >= 2) return value.slice(1, -1);
  return undefined;
}

function parseDestructuredSegment(segment: string): InferredKitParam | null {
  const trimmed = segment.trim();
  if (!trimmed || trimmed.startsWith("...")) return null;

  const assignIdx = findTopLevelChar(trimmed, "=");
  if (assignIdx !== -1) {
    const left = trimmed.slice(0, assignIdx).trim();
    const defaultRaw = trimmed.slice(assignIdx + 1).trim();
    const key = left.includes(":") ? left.split(":")[0]!.trim() : left;
    if (!/^[A-Za-z_$][\w$]*$/.test(key)) return null;
    const defaultValue = parseLiteral(defaultRaw);
    return defaultValue !== undefined ? { key, defaultValue } : { key };
  }

  const colonIdx = findTopLevelChar(trimmed, ":");
  if (colonIdx !== -1) {
    const key = trimmed.slice(0, colonIdx).trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(key)) return null;
    return { key };
  }

  if (!/^[A-Za-z_$][\w$]*$/.test(trimmed)) return null;
  return { key: trimmed };
}

function findTopLevelChar(input: string, target: string): number {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (quote) {
      if (ch === quote && input[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") depth += 1;
    else if (ch === "}" || ch === "]" || ch === ")") depth -= 1;
    else if (ch === target && depth === 0) return i;
  }
  return -1;
}

function objectDestructuringSource(fn: Function): string | undefined {
  const src = fn.toString().trim();
  const MAX_KIT_SOURCE_LEN = 64_000;
  const bounded = src.length > MAX_KIT_SOURCE_LEN ? src.slice(0, MAX_KIT_SOURCE_LEN) : src;

  let i = 0;
  if (bounded.startsWith("async")) i = "async".length;
  i = skipWhitespace(bounded, i);
  if (bounded.slice(i).startsWith("function")) i += "function".length;
  i = skipWhitespace(bounded, i);
  if (bounded[i] !== "(") return undefined;
  i = skipWhitespace(bounded, i + 1);
  if (bounded[i] !== "{") return undefined;

  const start = i + 1;
  let depth = 1;
  i += 1;
  let quote: "'" | '"' | "`" | null = null;
  while (i < bounded.length && depth > 0) {
    const ch = bounded[i]!;
    if (quote) {
      if (ch === quote && bounded[i - 1] !== "\\") quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  if (depth !== 0) return undefined;
  return bounded.slice(start, i - 1);
}

function skipWhitespace(src: string, start: number): number {
  let i = start;
  while (i < src.length && /\s/.test(src[i]!)) i += 1;
  return i;
}

/** Read destructured parameter keys (and inline defaults) from a kit callback. */
export function inferKitParams(fn: Function): InferredKitParam[] {
  const inner = objectDestructuringSource(fn);
  if (!inner) return [];
  return splitTopLevelCommas(inner)
    .map(parseDestructuredSegment)
    .filter((param): param is InferredKitParam => param !== null);
}

export function controlsFromKitParams(params: InferredKitParam[]): Record<string, CompactPlaygroundControl> {
  const out: Record<string, CompactPlaygroundControl> = {};
  for (const param of params) {
    out[param.key] = param.defaultValue ?? param.key;
  }
  return out;
}
