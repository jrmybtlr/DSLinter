import type { CompactPlaygroundControl } from "./expandPlaygroundControls";
import {
  findMatchingDelimiter,
  findTopLevelChar,
  kitSource,
  skipWhitespace,
  splitTopLevel,
} from "./jsxSource";

export type InferredKitParam = {
  key: string;
  defaultValue?: CompactPlaygroundControl;
};

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

  const assignIndex = findTopLevelChar(trimmed, "=");
  if (assignIndex !== -1) {
    const left = trimmed.slice(0, assignIndex).trim();
    const defaultRaw = trimmed.slice(assignIndex + 1).trim();
    const key = left.includes(":") ? left.split(":")[0]!.trim() : left;
    if (!/^[A-Za-z_$][\w$]*$/.test(key)) return null;
    const defaultValue = parseLiteral(defaultRaw);
    return defaultValue !== undefined ? { key, defaultValue } : { key };
  }

  const colonIndex = findTopLevelChar(trimmed, ":");
  if (colonIndex !== -1) {
    const key = trimmed.slice(0, colonIndex).trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(key)) return null;
    return { key };
  }

  if (!/^[A-Za-z_$][\w$]*$/.test(trimmed)) return null;
  return { key: trimmed };
}

/** Extract the `{ … }` parameter list from a destructured kit callback. */
function objectDestructuringSource(fn: Function): string | undefined {
  const source = kitSource(fn).trim();

  let index = 0;
  if (source.startsWith("async")) index = "async".length;
  index = skipWhitespace(source, index);
  if (source.slice(index).startsWith("function")) index += "function".length;
  index = skipWhitespace(source, index);
  if (source[index] !== "(") return undefined;

  index = skipWhitespace(source, index + 1);
  if (source[index] !== "{") return undefined;

  const closeIndex = findMatchingDelimiter(source, index, "{", "}");
  if (closeIndex === -1) return undefined;
  return source.slice(index + 1, closeIndex);
}

/** Read destructured parameter keys (and inline defaults) from a kit callback. */
export function inferKitParams(fn: Function): InferredKitParam[] {
  const inner = objectDestructuringSource(fn);
  if (!inner) return [];
  return splitTopLevel(inner, ",")
    .map(parseDestructuredSegment)
    .filter((param): param is InferredKitParam => param !== null);
}

export function controlsFromKitParams(
  params: InferredKitParam[],
): Record<string, CompactPlaygroundControl> {
  const out: Record<string, CompactPlaygroundControl> = {};
  for (const param of params) {
    out[param.key] = param.defaultValue ?? param.key;
  }
  return out;
}
