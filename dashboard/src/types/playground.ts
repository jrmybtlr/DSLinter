import type { ReactNode } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "./controls";
import type { PlaygroundPreviewComponent } from "./preview";

export type PlaygroundMeta = {
  /** Stable URL segment — matches `PlaygroundSpec.id` from dslint. */
  id: string;
  title: string;
  /** From dslint `playground_groups` config (or manual `definePlayground`). */
  group?: string;
};

export type PlaygroundEntry = {
  id: string;
  meta: PlaygroundMeta;
  modulePath: string;
  /** Optional controls shown above the preview; omit or use `[]` for static demos. */
  controls: PlaygroundControl[];
  /** Optional JSX-ish snippet from current `values` (consumer-defined). */
  usageSnippet?: (values: PlaygroundArgs) => string;
  /** Render live preview from control values (preferred — avoids unstable component types). */
  renderPreview: (values: PlaygroundArgs) => ReactNode;
  /** @deprecated Use `renderPreview` — kept for manual `definePlayground` call sites. */
  Preview: PlaygroundPreviewComponent;
};
