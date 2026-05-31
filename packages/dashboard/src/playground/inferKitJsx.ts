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
  return fn.toString();
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
  const re = /<([A-Z][A-Za-z0-9]*)(?:\s[^>]*)?>\s*\{\s*([A-Za-z_$][\w$]*)\s*\}\s*<\/\1>/g;
  for (const match of src.matchAll(re)) {
    out.push({ component: match[1]!, param: match[2]! });
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

function collectRootPropBindings(src: string, out: KitRootPropBinding[]): void {
  const normalized = normalizeKitSource(src);
  for (const match of normalized.matchAll(RUNTIME_ROOT_PROPS_RE)) {
    for (const binding of parseJsxPropsObject(match[2])) {
      out.push({ component: match[1]!, prop: binding.prop, param: binding.param });
    }
  }

  const sourceRoot = /<([A-Z][A-Za-z0-9]*)([^>]*)>/g;
  for (const match of src.matchAll(sourceRoot)) {
    const attrs = match[2] ?? "";
    const attrRe = /\b([A-Za-z_$][\w$]*)\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/g;
    for (const attr of attrs.matchAll(attrRe)) {
      const prop = attr[1]!;
      if (prop === "className" || prop === "style" || prop === "asChild") continue;
      out.push({ component: match[1]!, prop, param: attr[2]! });
    }
  }
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
