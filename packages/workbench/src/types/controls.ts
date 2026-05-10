/** Values passed from the workbench control panel into `PlaygroundPreview`. */
export type PlaygroundArgs = Record<string, string | number | boolean>;

export type PlaygroundBooleanControl = {
  key: string;
  label: string;
  type: "boolean";
  default: boolean;
  hint?: string;
};

export type PlaygroundStringControl = {
  key: string;
  label: string;
  type: "string";
  default: string;
  placeholder?: string;
};

export type PlaygroundNumberControl = {
  key: string;
  label: string;
  type: "number";
  default: number;
  min?: number;
  max?: number;
  step?: number;
};

export type PlaygroundSelectControl = {
  key: string;
  label: string;
  type: "select";
  default: string;
  options: { value: string; label: string }[];
};

export type PlaygroundControl =
  | PlaygroundBooleanControl
  | PlaygroundStringControl
  | PlaygroundNumberControl
  | PlaygroundSelectControl;

export function defaultArgsFromControls(controls: PlaygroundControl[] | undefined): PlaygroundArgs {
  const out: PlaygroundArgs = {};
  if (!controls) return out;
  for (const c of controls) {
    switch (c.type) {
      case "boolean":
        out[c.key] = c.default;
        break;
      case "string":
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
