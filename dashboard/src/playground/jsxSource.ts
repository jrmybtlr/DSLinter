/**
 * Tiny source scanners shared by the kit-inference helpers.
 *
 * These are intentionally not a full JSX parser: they only handle the
 * single-expression callbacks emitted by `definePlayground({ kit })`.
 */

export const MAX_KIT_SOURCE_LENGTH = 64_000;

/** `fn.toString()`, bounded so pathological sources cannot stall inference. */
export function kitSource(fn: Function): string {
  const source = fn.toString();
  return source.length > MAX_KIT_SOURCE_LENGTH ? source.slice(0, MAX_KIT_SOURCE_LENGTH) : source;
}

export function isIdentStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch);
}

export function isIdentPart(ch: string): boolean {
  return /[\w$]/.test(ch);
}

export function skipWhitespace(source: string, start: number): number {
  let index = start;
  while (index < source.length && /\s/.test(source[index]!)) index += 1;
  return index;
}

/** Read an identifier starting at `start`, optionally requiring a PascalCase name. */
export function readIdent(
  source: string,
  start: number,
  firstUpper = false,
): { value: string; end: number } | null {
  if (start >= source.length) return null;
  const first = source[start]!;
  if (firstUpper && !/[A-Z]/.test(first)) return null;
  if (!isIdentStart(first)) return null;

  let end = start + 1;
  while (end < source.length && isIdentPart(source[end]!)) end += 1;
  const value = source.slice(start, end);
  if (firstUpper && !/^[A-Z][A-Za-z0-9]*$/.test(value)) return null;
  return { value, end };
}

/** Index of `target` outside string literals, or `-1`. */
export function skipUntilChar(source: string, start: number, target: string): number {
  let quote: "'" | '"' | "`" | null = null;
  for (let index = start; index < source.length; index += 1) {
    const ch = source[index]!;
    if (quote) {
      if (ch === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === target) return index;
  }
  return -1;
}

/** Index of the delimiter matching the one at `openIndex`, or `-1`. */
export function findMatchingDelimiter(
  source: string,
  openIndex: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;

  for (let index = openIndex; index < source.length; index += 1) {
    const ch = source[index]!;
    if (quote) {
      if (ch === quote && source[index - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === open) {
      depth += 1;
      continue;
    }
    if (ch === close && --depth === 0) return index;
  }
  return -1;
}

const OPEN_DELIMITERS = "{[(";
const CLOSE_DELIMITERS = "}])";

/** Split on `separator` only at the top level (outside strings/brackets). */
export function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let start = 0;

  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index]!;
    if (quote) {
      if (ch === quote && input[index - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (OPEN_DELIMITERS.includes(ch)) depth += 1;
    else if (CLOSE_DELIMITERS.includes(ch)) depth -= 1;
    else if (ch === separator && depth === 0) {
      parts.push(input.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(input.slice(start));
  return parts;
}

/** Index of `target` at the top level, or `-1`. */
export function findTopLevelChar(input: string, target: string): number {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index]!;
    if (quote) {
      if (ch === quote && input[index - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (OPEN_DELIMITERS.includes(ch)) depth += 1;
    else if (CLOSE_DELIMITERS.includes(ch)) depth -= 1;
    else if (ch === target && depth === 0) return index;
  }
  return -1;
}

/**
 * Vite/esbuild wraps JSX as `(0, import.createElement)(Type, props)`
 * (often split across lines).
 */
export function normalizeJsxRuntimeSource(source: string): string {
  return source
    .replace(/\(\s*0\s*,\s*(?:[\w$.]+\.)?(jsx(?:DEV)?|createElement)\)\s*\(/g, "$1(")
    .replace(/(?:[\w$.]+\.)?(jsx(?:DEV)?|createElement)\(/g, "$1(");
}
