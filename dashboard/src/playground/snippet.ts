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
  if (typeof value === "number") {
    return `${key}={${value}}`;
  }
  if (typeof value === "boolean") {
    return `${key}={${value}}`;
  }
  if (Array.isArray(value)) {
    return `${key}={${JSON.stringify(value)}}`;
  }
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
  const controlByKey = new Map(controls.map((c) => [c.key, c] as const));
  const propsForSnippet = coercedProps ?? panelValues;

  const emitPropKey = (key: string): boolean => {
    const c = controlByKey.get(key);
    if (!c) return true;
    return !valueMatchesPlaygroundDefault(c, panelValues[key]);
  };

  const hasChildrenKey = Object.prototype.hasOwnProperty.call(
    panelValues,
    "children",
  );
  const childVal = hasChildrenKey ? panelValues.children : undefined;

  const propKeys = Object.keys(propsForSnippet)
    .filter((k) => k !== "children")
    .filter(emitPropKey)
    .sort((a, b) => a.localeCompare(b));
  const propsStr = propKeys
    .map((k) => formatJsxPropAssignment(k, propsForSnippet[k]))
    .join(" ");

  const openWithProps =
    propKeys.length === 0 ? `<${exportName}` : `<${exportName} ${propsStr}`;

  if (!hasChildrenKey) {
    return propKeys.length === 0 ? `<${exportName} />` : `${openWithProps} />`;
  }

  if (typeof childVal === "boolean") {
    const allKeys = Object.keys(propsForSnippet)
      .filter(emitPropKey)
      .sort((a, b) => a.localeCompare(b));
    const allProps = allKeys
      .map((k) => formatJsxPropAssignment(k, propsForSnippet[k]))
      .join(" ");
    return allKeys.length === 0
      ? `<${exportName} />`
      : `<${exportName} ${allProps} />`;
  }

  const asText =
    typeof childVal === "number" ? String(childVal) : String(childVal ?? "");
  if (asText.length === 0) {
    return propKeys.length === 0 ? `<${exportName} />` : `${openWithProps} />`;
  }

  const body = jsxTextOrStringifyExpression(asText);
  return propKeys.length === 0
    ? `<${exportName}>${body}</${exportName}>`
    : `${openWithProps}>${body}</${exportName}>`;
}
