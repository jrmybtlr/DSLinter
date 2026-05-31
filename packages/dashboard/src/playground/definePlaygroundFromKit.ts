import type { PlaygroundArgs } from "../types/controls";
import {
  definePlayground,
  type DefinedPlayground,
  type DefinePlaygroundKitOptions,
} from "./definePlayground";

/** @deprecated Use `definePlayground({ kit, controls })` instead. */
export type DefinePlaygroundFromKitOptions<T extends PlaygroundArgs> =
  DefinePlaygroundKitOptions<T>;

/** @deprecated Use `definePlayground({ kit, controls })` instead. */
export function definePlaygroundFromKit<T extends PlaygroundArgs>(
  options: DefinePlaygroundFromKitOptions<T>,
): DefinedPlayground {
  return definePlayground(options);
}
