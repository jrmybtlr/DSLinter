import type { ReactNode } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import { definePlayground, type DefinedPlayground } from "./definePlayground";
import {
  expandPlaygroundControls,
  propsFromControls,
  type CompactPlaygroundControl,
} from "./expandPlaygroundControls";

export type DefinePlaygroundFromKitOptions<T extends PlaygroundArgs> = {
  /**
   * Catalog id (matches component `export_name`). Omit when the module export is
   * `{name}Playground` (e.g. `alertPlayground` → `Alert`).
   */
  id?: string;
  title?: string;
  group?: string;
  /** Preview renderer receiving mapped control values. */
  kit: (args: T) => ReactNode;
  controls?: PlaygroundControl[] | Record<string, CompactPlaygroundControl>;
  /** Extra defaults merged after control defaults. */
  defaults?: Partial<T>;
};

/**
 * Shorthand for `definePlayground({ render })` + preview-kit wiring.
 * Control keys are passed to `kit` without repeating defaults in `render`.
 */
export function definePlaygroundFromKit<T extends PlaygroundArgs>(
  options: DefinePlaygroundFromKitOptions<T>,
): DefinedPlayground {
  const controls = expandPlaygroundControls(options.controls);
  return definePlayground({
    id: options.id,
    title: options.title,
    group: options.group,
    controls,
    render: (values) =>
      options.kit(propsFromControls<T>(controls, values, options.defaults)),
  });
}
