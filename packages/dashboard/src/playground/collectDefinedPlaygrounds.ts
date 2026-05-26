import { createElement } from "react";
import type { DefinedPlayground } from "./definePlayground";
import type { PlaygroundEntry, PlaygroundPreviewComponent } from "../types/playground";
import type { PlaygroundArgs } from "../types/controls";
import type { BuildPlaygroundModules } from "./buildPlaygroundEntriesFromReport";

function isDefinedPlayground(value: unknown): value is DefinedPlayground {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (typeof o.playgroundMeta !== "object" || o.playgroundMeta === null) return false;
  const meta = o.playgroundMeta as { id?: unknown; title?: unknown; group?: unknown };
  return (
    typeof meta.id === "string" &&
    typeof meta.title === "string" &&
    (meta.group === undefined || typeof meta.group === "string") &&
    Array.isArray(o.playgroundControls) &&
    typeof o.PlaygroundPreview === "function"
  );
}

function definedPlaygroundToEntry(
  defined: DefinedPlayground,
  modulePath: string,
): PlaygroundEntry {
  const { playgroundMeta, playgroundControls, PlaygroundPreview } = defined;
  const Preview = PlaygroundPreview as PlaygroundPreviewComponent;
  const renderPreview = (values: PlaygroundArgs) =>
    createElement(Preview, { values });

  return {
    id: playgroundMeta.id,
    meta: playgroundMeta,
    modulePath,
    controls: playgroundControls,
    renderPreview,
    Preview,
  };
}

/** Collect manual playground entries from `definePlayground()` exports in eager modules. */
export function collectDefinedPlaygrounds(
  modules: BuildPlaygroundModules,
): PlaygroundEntry[] {
  const out: PlaygroundEntry[] = [];
  for (const [modulePath, mod] of Object.entries(modules)) {
    if (!mod || typeof mod !== "object") continue;
    for (const value of Object.values(mod)) {
      if (!isDefinedPlayground(value)) continue;
      out.push(definedPlaygroundToEntry(value, modulePath));
    }
  }
  return out;
}
