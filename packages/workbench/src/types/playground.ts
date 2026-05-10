import type { PlaygroundArgs, PlaygroundControl } from "./controls";
import type { PlaygroundPreviewComponent } from "./preview";

export type PlaygroundSection = "good" | "bad";

export type PlaygroundMeta = {
  /** Stable URL segment, typically the component file basename without extension. */
  id: string;
  title: string;
  section: PlaygroundSection;
  description?: string;
};

export type PlaygroundEntry = {
  id: string;
  meta: PlaygroundMeta;
  modulePath: string;
  /** Optional controls shown above the preview; omit or use `[]` for static demos. */
  controls: PlaygroundControl[];
  /** Optional JSX-ish snippet from current `values` (consumer-defined). */
  usageSnippet?: (values: PlaygroundArgs) => string;
  Preview: PlaygroundPreviewComponent;
};
