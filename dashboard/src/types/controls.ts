/** Values passed from the dashboard control panel into `PlaygroundPreview`. */
export type PlaygroundArgs = Record<string, string | number | boolean>;

export type PlaygroundValuesUpdater = (
  next: PlaygroundArgs | ((prev: PlaygroundArgs) => PlaygroundArgs),
) => void;

/** Generated examples should not be presented as real API defaults. */
export type PlaygroundDefaultSource = "type" | "example" | "manual";

type PlaygroundControlBase = {
  key: string;
  label: string;
  defaultSource?: PlaygroundDefaultSource;
  hint?: string;
  /** When true, API reference Prop column shows `key?`. */
  optional?: boolean;
};

export type PlaygroundBooleanControl = PlaygroundControlBase & {
  type: "boolean";
  default: boolean;
};

export type PlaygroundStringControl = PlaygroundControlBase & {
  type: "string";
  default: string;
  placeholder?: string;
};

/** Panel value is multiline text; coerced to `string[]` for the preview. */
export type PlaygroundStringArrayControl = PlaygroundControlBase & {
  type: "stringArray";
  default: string;
  placeholder?: string;
};

/** Panel value is multiline text; coerced to `number[]` for the preview. */
export type PlaygroundNumberArrayControl = PlaygroundControlBase & {
  type: "numberArray";
  default: string;
  placeholder?: string;
};

export type PlaygroundNodeControl = PlaygroundControlBase & {
  type: "node";
  default: string;
  placeholder?: string;
};

/** Display-only: Type column uses `typeLabel`; Value is not editable. */
export type PlaygroundIconControl = PlaygroundControlBase & {
  type: "icon";
  default: string;
  typeLabel: string;
};

/** Display-only: object / interface props (e.g. `Passkey`). */
export type PlaygroundObjectControl = PlaygroundControlBase & {
  type: "object";
  default: string;
  typeLabel: string;
};

/** Display-only: callback props (e.g. `onDelete`). */
export type PlaygroundFunctionControl = PlaygroundControlBase & {
  type: "function";
  default: string;
  typeLabel: string;
};

export type PlaygroundNumberControl = PlaygroundControlBase & {
  type: "number";
  default: number;
  min?: number;
  max?: number;
  step?: number;
};

export type PlaygroundSelectControl = PlaygroundControlBase & {
  type: "select";
  default: string;
  options: { value: string; label: string }[];
};

export type PlaygroundControl =
  | PlaygroundBooleanControl
  | PlaygroundStringControl
  | PlaygroundStringArrayControl
  | PlaygroundNumberArrayControl
  | PlaygroundNodeControl
  | PlaygroundIconControl
  | PlaygroundObjectControl
  | PlaygroundFunctionControl
  | PlaygroundNumberControl
  | PlaygroundSelectControl;

const NON_EDITABLE_CONTROL_TYPES = new Set([
  "icon",
  "object",
  "function",
]);

export function isNonEditableControl(
  c: PlaygroundControl,
): c is PlaygroundIconControl | PlaygroundObjectControl | PlaygroundFunctionControl {
  return NON_EDITABLE_CONTROL_TYPES.has(c.type);
}

export function defaultArgsFromControls(controls: PlaygroundControl[] | undefined): PlaygroundArgs {
  const out: PlaygroundArgs = {};
  if (!controls) return out;
  for (const c of controls) {
    if (isNonEditableControl(c)) continue;
    switch (c.type) {
      case "boolean":
        out[c.key] = c.default;
        break;
      case "string":
      case "stringArray":
      case "numberArray":
      case "node":
      case "select":
        out[c.key] = c.default;
        break;
      case "number":
        out[c.key] = c.default;
        break;
    }
  }
  return out;
}
