import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";

function jsxTextOrStringifyExpression(text: string): string {
  if (!/[<>{}&]/.test(text)) return text;
  return `{JSON.stringify(${JSON.stringify(text)})}`;
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
    case "select":
      return String(value ?? "") === String(control.default);
    default:
      return false;
  }
}

export function genericUsageSnippet(
  exportName: string,
  values: PlaygroundArgs,
  controls: PlaygroundControl[],
): string {
  const controlByKey = new Map(controls.map((c) => [c.key, c] as const));

  const emitPropKey = (key: string): boolean => {
    const c = controlByKey.get(key);
    if (!c) return true;
    return !valueMatchesPlaygroundDefault(c, values[key]);
  };

  const hasChildrenKey = Object.prototype.hasOwnProperty.call(
    values,
    "children",
  );
  const childVal = hasChildrenKey ? values.children : undefined;

  const propKeys = Object.keys(values)
    .filter((k) => k !== "children")
    .filter(emitPropKey)
    .sort((a, b) => a.localeCompare(b));
  const propsStr = propKeys
    .map((k) => `${k}={${JSON.stringify(values[k])}}`)
    .join(" ");

  const openWithProps =
    propKeys.length === 0 ? `<${exportName}` : `<${exportName} ${propsStr}`;

  if (!hasChildrenKey) {
    return propKeys.length === 0 ? `<${exportName} />` : `${openWithProps} />`;
  }

  if (typeof childVal === "boolean") {
    const allKeys = Object.keys(values)
      .filter(emitPropKey)
      .sort((a, b) => a.localeCompare(b));
    const allProps = allKeys
      .map((k) => `${k}={${JSON.stringify(values[k])}}`)
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
