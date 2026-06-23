export type KitJsxSlot = {
  param: string;
  component: string;
};

export type KitRootPropBinding = {
  param: string;
  component: string;
  prop: string;
};

function kitSource(fn: Function): string {
  const src = fn.toString();
  const MAX_KIT_SOURCE_LEN = 64_000;
  return src.length > MAX_KIT_SOURCE_LEN ? src.slice(0, MAX_KIT_SOURCE_LEN) : src;
}

function skipWhitespace(src: string, start: number): number {
  let i = start;
  while (i < src.length && /\s/.test(src[i]!)) i += 1;
  return i;
}

function isIdentChar(ch: string, first = false): boolean {
  if (first) return /[A-Za-z_$]/.test(ch);
  return /[\w$]/.test(ch);
}

function readIdent(
  src: string,
  start: number,
  firstUpper = false,
): { value: string; end: number } | null {
  if (start >= src.length) return null;
  const ch = src[start]!;
  if (firstUpper && !/[A-Z]/.test(ch)) return null;
  if (!isIdentChar(ch, true)) return null;
  let end = start + 1;
  while (end < src.length && isIdentChar(src[end]!, false)) end += 1;
  const value = src.slice(start, end);
  if (firstUpper && !/^[A-Z][A-Za-z0-9]*$/.test(value)) return null;
  return { value, end };
}

function skipUntilChar(src: string, start: number, target: string): number {
  let quote: "'" | '"' | "`" | null = null;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quote) {
      if (ch === quote && src[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === target) return i;
  }
  return -1;
}

/** Vite/esbuild wraps JSX as `(0, import.createElement)(Type, props)` (often split across lines). */
function normalizeKitSource(src: string): string {
  return src
    .replace(/\(\s*0\s*,\s*(?:[\w$.]+\.)?(jsx(?:DEV)?|createElement)\)\s*\(/g, "$1(")
    .replace(/(?:[\w$.]+\.)?(jsx(?:DEV)?|createElement)\(/g, "$1(");
}

/** `AlertTitle` → `Title`; `DialogDescription` → `Description`. */
export function slotLabelFromComponent(component: string): string {
  const match = component.match(/^[A-Z][a-z]+(?=[A-Z])/);
  const suffix = match ? component.slice(match[0].length) : component;
  return suffix
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/** Example copy for common compound slot names. */
export function slotDefaultFromComponent(component: string): string | undefined {
  if (component.endsWith("Title")) return "Heads up";
  if (component.endsWith("Description")) return "This is a short description.";
  if (component.endsWith("Trigger") || component.includes("Trigger")) return "Open";
  if (component.endsWith("Content")) return "Content";
  if (component.endsWith("Label")) return "Label";
  return undefined;
}

const RUNTIME_CHILDREN_SLOT_RE =
  /(?:jsx(?:DEV)?|createElement)\(\s*([A-Za-z_$][\w$]*)\s*,\s*[^,]*,\s*([A-Za-z_$][\w$]*)\s*(?:\)|,)/g;
const RUNTIME_CHILDREN_PROP_RE =
  /(?:jsx(?:DEV)?|createElement)\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{[^}]*\bchildren:\s*([A-Za-z_$][\w$]*)/g;
const RUNTIME_ROOT_PROPS_RE =
  /(?:jsx(?:DEV)?|createElement)\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{([\s\S]*?)\}\s*(?:,|\))/g;

function collectJsxRuntimeSlots(src: string, out: KitJsxSlot[]): void {
  const normalized = normalizeKitSource(src);
  for (const match of normalized.matchAll(RUNTIME_CHILDREN_SLOT_RE)) {
    out.push({ component: match[1]!, param: match[2]! });
  }
  for (const match of normalized.matchAll(RUNTIME_CHILDREN_PROP_RE)) {
    out.push({ component: match[1]!, param: match[2]! });
  }
}

function collectSourceJsxSlots(src: string, out: KitJsxSlot[]): void {
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) break;
    if (src[lt + 1] === "/") {
      i = lt + 1;
      continue;
    }
    const ident = readIdent(src, lt + 1, true);
    if (!ident) {
      i = lt + 1;
      continue;
    }
    const tagEnd = skipUntilChar(src, ident.end, ">");
    if (tagEnd === -1) break;
    let j = skipWhitespace(src, tagEnd + 1);
    if (src[j] !== "{") {
      i = lt + 1;
      continue;
    }
    j = skipWhitespace(src, j + 1);
    const paramIdent = readIdent(src, j);
    if (!paramIdent) {
      i = lt + 1;
      continue;
    }
    j = skipWhitespace(src, paramIdent.end);
    if (src[j] !== "}") {
      i = lt + 1;
      continue;
    }
    j = skipWhitespace(src, j + 1);
    const closeTag = `</${ident.value}>`;
    if (!src.slice(j).startsWith(closeTag)) {
      i = lt + 1;
      continue;
    }
    out.push({ component: ident.value, param: paramIdent.value });
    i = j + closeTag.length;
  }
}

/** Map kit params to compound subcomponents (`AlertTitle`, etc.) from JSX. */
export function inferKitJsxSlots(fn: Function): KitJsxSlot[] {
  const src = kitSource(fn);
  const out: KitJsxSlot[] = [];
  collectSourceJsxSlots(src, out);
  collectJsxRuntimeSlots(src, out);

  const seen = new Set<string>();
  return out.filter((slot) => {
    const id = `${slot.component}:${slot.param}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function parseJsxPropsObject(raw: string | undefined): Array<{ prop: string; param: string }> {
  if (!raw) return [];
  const body = raw.trim();
  const out: Array<{ prop: string; param: string }> = [];

  if (/^[A-Za-z_$][\w$]*$/.test(body)) {
    return [{ prop: body, param: body }];
  }

  const re = /\b([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\b/g;
  for (const match of raw.matchAll(re)) {
    const prop = match[1]!;
    const param = match[2]!;
    if (prop === "children" || prop === "className" || prop === "style" || prop === "asChild") {
      continue;
    }
    out.push({ prop, param });
  }

  // ES shorthand `{ variant }` → `variant: variant`
  const shorthandRe = /(?:^|[,{]\s*)([A-Za-z_$][\w$]*)\s*(?=[,}])/g;
  for (const match of raw.matchAll(shorthandRe)) {
    const prop = match[1]!;
    if (
      prop === "children" ||
      prop === "className" ||
      prop === "style" ||
      prop === "asChild" ||
      out.some((binding) => binding.prop === prop)
    ) {
      continue;
    }
    out.push({ prop, param: prop });
  }

  return out;
}

function parseJsxAttrBindings(attrs: string, component: string, out: KitRootPropBinding[]): void {
  let i = 0;
  while (i < attrs.length) {
    i = skipWhitespace(attrs, i);
    if (i >= attrs.length) break;
    const propIdent = readIdent(attrs, i);
    if (!propIdent) {
      i += 1;
      continue;
    }
    i = skipWhitespace(attrs, propIdent.end);
    if (attrs[i] !== "=") {
      i = propIdent.end;
      continue;
    }
    i = skipWhitespace(attrs, i + 1);
    if (attrs[i] !== "{") {
      i += 1;
      continue;
    }
    i = skipWhitespace(attrs, i + 1);
    const paramIdent = readIdent(attrs, i);
    if (!paramIdent) continue;
    const prop = propIdent.value;
    if (prop === "className" || prop === "style" || prop === "asChild") {
      i = paramIdent.end;
      continue;
    }
    out.push({ component, prop, param: paramIdent.value });
    i = paramIdent.end;
  }
}

function collectSourceRootPropBindings(src: string, out: KitRootPropBinding[]): void {
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt === -1) break;
    if (src[lt + 1] === "/") {
      i = lt + 1;
      continue;
    }
    const ident = readIdent(src, lt + 1, true);
    if (!ident) {
      i = lt + 1;
      continue;
    }
    const tagEnd = skipUntilChar(src, ident.end, ">");
    if (tagEnd === -1) break;
    parseJsxAttrBindings(src.slice(ident.end, tagEnd), ident.value, out);
    i = tagEnd + 1;
  }
}

function collectRootPropBindings(src: string, out: KitRootPropBinding[]): void {
  const normalized = normalizeKitSource(src);
  for (const match of normalized.matchAll(RUNTIME_ROOT_PROPS_RE)) {
    for (const binding of parseJsxPropsObject(match[2])) {
      out.push({ component: match[1]!, prop: binding.prop, param: binding.param });
    }
  }

  collectSourceRootPropBindings(src, out);
}

/** Root component prop bindings such as `<Alert variant={variant}>`. */
export function inferKitRootPropBindings(fn: Function): KitRootPropBinding[] {
  const src = kitSource(fn);
  const out: KitRootPropBinding[] = [];
  collectRootPropBindings(src, out);

  const seen = new Set<string>();
  return out.filter((binding) => {
    const id = `${binding.component}.${binding.prop}:${binding.param}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function primaryRootComponent(fn: Function): string | undefined {
  const bindings = inferKitRootPropBindings(fn);
  if (bindings.length > 0) return bindings[0]!.component;
  const slots = inferKitJsxSlots(fn);
  for (const slot of slots) {
    const prefix = slot.component.match(/^[A-Z][a-z]+(?=[A-Z])/)?.[0];
    if (prefix && slot.component.startsWith(prefix)) return prefix;
  }
  return undefined;
}
