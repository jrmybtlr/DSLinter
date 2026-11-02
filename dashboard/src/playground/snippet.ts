import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";

function jsxTextOrStringifyExpression(text: string): string {
  if (!/[<>{}&]/.test(text)) return text;
  return `{JSON.stringify(${JSON.stringify(text)})}`;
}

export function formatJsxPropAssignment(key: string, value: unknown): string {
  if (value === true) {
    return key;
  }
  if (typeof value === "string") {
    if (!/["'{}<>&\n\r]/.test(value)) {
      return `${key}="${value}"`;
    }
    return `${key}={${JSON.stringify(value)}}`;
  }
  // Numbers, booleans, arrays and objects all use JSX expression syntax.
  return `${key}={${JSON.stringify(value)}}`;
}

function valueMatchesPlaygroundDefault(
  control: PlaygroundControl,
  value: string | number | boolean | undefined,
): boolean {
  switch (control.type) {
    case "boolean":
      return Boolean(value) === control.default;
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) && n === control.default;
    }
    case "string":
    case "stringArray":
    case "numberArray":
    case "node":
    case "select":
      return String(value ?? "") === String(control.default);
    case "icon":
    case "object":
    case "function":
      return true;
    default:
      return false;
  }
}

export function genericUsageSnippet(
  exportName: string,
  panelValues: PlaygroundArgs,
  controls: PlaygroundControl[],
  coercedProps?: Record<string, unknown>,
): string {
  const controlByKey = new Map(controls.map((control) => [control.key, control] as const));
  const propsForSnippet = coercedProps ?? panelValues;

  const shouldEmit = (key: string): boolean => {
    const control = controlByKey.get(key);
    return !control || !valueMatchesPlaygroundDefault(control, panelValues[key]);
  };

  const sortedKeys = (includeChildren: boolean): string[] =>
    Object.keys(propsForSnippet)
      .filter((key) => (includeChildren || key !== "children") && shouldEmit(key))
      .sort((a, b) => a.localeCompare(b));

  const renderProps = (keys: string[]): string =>
    keys.map((key) => formatJsxPropAssignment(key, propsForSnippet[key])).join(" ");

  const selfClosing = (keys: string[]): string =>
    keys.length === 0 ? `<${exportName} />` : `<${exportName} ${renderProps(keys)} />`;

  const propKeys = sortedKeys(false);
  const hasChildrenKey = Object.prototype.hasOwnProperty.call(panelValues, "children");
  const childValue = hasChildrenKey ? panelValues.children : undefined;

  if (!hasChildrenKey) return selfClosing(propKeys);

  // A boolean children value is not meaningful as a slot; keep it as a prop.
  if (typeof childValue === "boolean") return selfClosing(sortedKeys(true));

  const asText = typeof childValue === "number" ? String(childValue) : String(childValue ?? "");
  if (asText.length === 0) return selfClosing(propKeys);

  const body = jsxTextOrStringifyExpression(asText);
  return propKeys.length === 0
    ? `<${exportName}>${body}</${exportName}>`
    : `<${exportName} ${renderProps(propKeys)}>${body}</${exportName}>`;
}
