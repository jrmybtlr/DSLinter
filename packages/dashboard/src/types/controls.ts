/** Values passed from the dashboard control panel into `PlaygroundPreview`. */
export type PlaygroundArgs = Record<string, string | number | boolean>;

export type PlaygroundValuesUpdater = (
  next: PlaygroundArgs | ((prev: PlaygroundArgs) => PlaygroundArgs),
) => void;

/** Generated examples should not be presented as real API defaults. */
export type PlaygroundDefaultSource = "type" | "example" | "manual";

export type PlaygroundBooleanControl = {
  key: string;
  label: string;
  type: "boolean";
  default: boolean;
  defaultSource?: PlaygroundDefaultSource;
  hint?: string;
};

export type PlaygroundStringControl = {
  key: string;
  label: string;
  type: "string";
  default: string;
  defaultSource?: PlaygroundDefaultSource;
  placeholder?: string;
};

export type PlaygroundNodeControl = {
  key: string;
  label: string;
  type: "node";
  default: string;
  defaultSource?: PlaygroundDefaultSource;
  placeholder?: string;
  hint?: string;
};

export type PlaygroundNumberControl = {
  key: string;
  label: string;
  type: "number";
  default: number;
  defaultSource?: PlaygroundDefaultSource;
  min?: number;
  max?: number;
  step?: number;
};

export type PlaygroundSelectControl = {
  key: string;
  label: string;
  type: "select";
  default: string;
  defaultSource?: PlaygroundDefaultSource;
  options: { value: string; label: string }[];
};

export type PlaygroundControl =
  | PlaygroundBooleanControl
  | PlaygroundStringControl
  | PlaygroundNodeControl
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
