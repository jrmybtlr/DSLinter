import {
  kitSource,
  normalizeJsxRuntimeSource,
  readIdent,
  skipUntilChar,
  skipWhitespace,
} from "./jsxSource";

export type KitJsxSlot = {
  param: string;
  component: string;
};

export type KitRootPropBinding = {
  param: string;
  component: string;
  prop: string;
};

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

type SourceTag = {
  name: string;
  /** Attribute source between the tag name and `>`. */
  attrs: string;
  /** Index of the closing `>`. */
  end: number;
};

/** Walk PascalCase JSX tags in source order (closing tags are skipped). */
function* sourceTags(source: string): Generator<SourceTag> {
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("<", index);
    if (open === -1) return;

    if (source[open + 1] === "/") {
      index = open + 1;
      continue;
    }

    const ident = readIdent(source, open + 1, true);
    if (!ident) {
      index = open + 1;
      continue;
    }

    const tagEnd = skipUntilChar(source, ident.end, ">");
    if (tagEnd === -1) return;

    yield { name: ident.value, attrs: source.slice(ident.end, tagEnd), end: tagEnd };
    index = tagEnd + 1;
  }
}

const RUNTIME_CHILDREN_SLOT_RE =
  /(?:jsx(?:DEV)?|createElement)\(\s*([A-Za-z_$][\w$]*)\s*,\s*[^,]*,\s*([A-Za-z_$][\w$]*)\s*(?:\)|,)/g;
const RUNTIME_CHILDREN_PROP_RE =
  /(?:jsx(?:DEV)?|createElement)\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{[^}]*\bchildren:\s*([A-Za-z_$][\w$]*)/g;
const RUNTIME_ROOT_PROPS_RE =
  /(?:jsx(?:DEV)?|createElement)\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{([\s\S]*?)\}\s*(?:,|\))/g;

function collectJsxRuntimeSlots(source: string, out: KitJsxSlot[]): void {
  const normalized = normalizeJsxRuntimeSource(source);
  for (const match of normalized.matchAll(RUNTIME_CHILDREN_SLOT_RE)) {
    out.push({ component: match[1]!, param: match[2]! });
  }
  for (const match of normalized.matchAll(RUNTIME_CHILDREN_PROP_RE)) {
    out.push({ component: match[1]!, param: match[2]! });
  }
}

function collectSourceJsxSlots(source: string, out: KitJsxSlot[]): void {
  for (const tag of sourceTags(source)) {
    let index = skipWhitespace(source, tag.end + 1);
    if (source[index] !== "{") continue;

    index = skipWhitespace(source, index + 1);
    const param = readIdent(source, index);
    if (!param) continue;

    index = skipWhitespace(source, param.end);
    if (source[index] !== "}") continue;

    index = skipWhitespace(source, index + 1);
    const closeTag = `</${tag.name}>`;
    if (!source.slice(index).startsWith(closeTag)) continue;

    out.push({ component: tag.name, param: param.value });
  }
}

/** Map kit params to compound subcomponents (`AlertTitle`, etc.) from JSX. */
export function inferKitJsxSlots(fn: Function): KitJsxSlot[] {
  const source = kitSource(fn);
  const slots: KitJsxSlot[] = [];
  collectSourceJsxSlots(source, slots);
  collectJsxRuntimeSlots(source, slots);

  const seen = new Set<string>();
  return slots.filter((slot) => {
    const id = `${slot.component}:${slot.param}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Props that should not become root control bindings. */
const NON_BINDING_PROPS = new Set(["className", "style", "asChild"]);

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
    if (prop === "children" || NON_BINDING_PROPS.has(prop)) continue;
    out.push({ prop, param });
  }

  // ES shorthand `{ variant }` → `variant: variant`
  const shorthandRe = /(?:^|[,{]\s*)([A-Za-z_$][\w$]*)\s*(?=[,}])/g;
  for (const match of raw.matchAll(shorthandRe)) {
    const prop = match[1]!;
    if (
      prop === "children" ||
      NON_BINDING_PROPS.has(prop) ||
      out.some((binding) => binding.prop === prop)
    ) {
      continue;
    }
    out.push({ prop, param: prop });
  }

  return out;
}

function parseJsxAttrBindings(attrs: string, component: string, out: KitRootPropBinding[]): void {
  let index = 0;
  while (index < attrs.length) {
    index = skipWhitespace(attrs, index);
    if (index >= attrs.length) break;

    const propIdent = readIdent(attrs, index);
    if (!propIdent) {
      index += 1;
      continue;
    }

    index = skipWhitespace(attrs, propIdent.end);
    if (attrs[index] !== "=") {
      index = propIdent.end;
      continue;
    }

    index = skipWhitespace(attrs, index + 1);
    if (attrs[index] !== "{") {
      index += 1;
      continue;
    }

    index = skipWhitespace(attrs, index + 1);
    const paramIdent = readIdent(attrs, index);
    if (!paramIdent) continue;

    const prop = propIdent.value;
    if (!NON_BINDING_PROPS.has(prop)) {
      out.push({ component, prop, param: paramIdent.value });
    }
    index = paramIdent.end;
  }
}

function collectSourceRootPropBindings(source: string, out: KitRootPropBinding[]): void {
  for (const tag of sourceTags(source)) {
    parseJsxAttrBindings(tag.attrs, tag.name, out);
  }
}

function collectRootPropBindings(source: string, out: KitRootPropBinding[]): void {
  const normalized = normalizeJsxRuntimeSource(source);
  for (const match of normalized.matchAll(RUNTIME_ROOT_PROPS_RE)) {
    for (const binding of parseJsxPropsObject(match[2])) {
      out.push({ component: match[1]!, prop: binding.prop, param: binding.param });
    }
  }

  collectSourceRootPropBindings(source, out);
}

/** Root component prop bindings such as `<Alert variant={variant}>`. */
export function inferKitRootPropBindings(fn: Function): KitRootPropBinding[] {
  const source = kitSource(fn);
  const bindings: KitRootPropBinding[] = [];
  collectRootPropBindings(source, bindings);

  const seen = new Set<string>();
  return bindings.filter((binding) => {
    const id = `${binding.component}.${binding.prop}:${binding.param}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
