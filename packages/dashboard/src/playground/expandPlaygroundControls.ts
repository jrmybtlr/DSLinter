import { defaultArgsFromControls } from "../types/controls";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";

export type CompactPlaygroundControl =
  | string
  | number
  | boolean
  | Partial<PlaygroundControl> & { key?: string };

function titleCase(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function isFullControl(value: CompactPlaygroundControl): value is PlaygroundControl {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as PlaygroundControl).type === "string"
  );
}

function expandOne(key: string, value: CompactPlaygroundControl): PlaygroundControl {
  if (isFullControl(value)) {
    const label = value.label ?? titleCase(key);
    return { ...value, key, label } as PlaygroundControl;
  }
  if (typeof value === "boolean") {
    return { key, label: titleCase(key), type: "boolean", default: value };
  }
  if (typeof value === "number") {
    return { key, label: titleCase(key), type: "number", default: value };
  }
  return { key, label: titleCase(key), type: "string", default: String(value) };
}

/** Expand shorthand `controls` records into full `PlaygroundControl` objects. */
export function expandPlaygroundControls(
  input: PlaygroundControl[] | Record<string, CompactPlaygroundControl> | undefined,
): PlaygroundControl[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return Object.entries(input).map(([key, value]) => expandOne(key, value));
}

/** Map panel values to a props object using control defaults (no manual `??` fallbacks). */
export function propsFromControls<T extends PlaygroundArgs>(
  controls: PlaygroundControl[],
  values: PlaygroundArgs,
  defaults?: Partial<T>,
): T {
  const out = { ...defaultArgsFromControls(controls), ...defaults } as Record<
    string,
    string | number | boolean
  >;
  for (const c of controls) {
    const v = values[c.key];
    if (v !== undefined) out[c.key] = v;
  }
  return out as T;
}
