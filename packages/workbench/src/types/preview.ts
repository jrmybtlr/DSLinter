import type { ComponentType } from "react";
import type { PlaygroundArgs } from "./controls";

export type PlaygroundPreviewProps = {
  values: PlaygroundArgs;
};

export type PlaygroundPreviewComponent = ComponentType<PlaygroundPreviewProps>;
