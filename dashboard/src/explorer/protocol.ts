import type { CatalogComponent } from "../types/report";

export const PREVIEW_PROTOCOL = "dslinter-preview-v1";
export type PreviewProvenance = "override" | "usage" | "recipe" | "generated";
export type PreviewCommand = {
  protocol: typeof PREVIEW_PROTOCOL;
  type: "mount" | "update" | "unmount";
  component?: CatalogComponent;
  catalog?: CatalogComponent[];
  values?: Record<string, unknown>;
};
export type PreviewResponse = {
  protocol: typeof PREVIEW_PROTOCOL;
  type: "ready" | "rendered" | "error" | "event";
  provenance?: PreviewProvenance;
  message?: string;
  attempts?: string[];
  event?: string;
  value?: unknown;
  snippet?: string;
  substitutedContext?: boolean;
  synthetic?: boolean;
  styles?: string[];
  controls?: import("../types/controls").PlaygroundControl[];
  values?: Record<string, string | number | boolean>;
};

export type PreviewAdapter = {
  styles?: string[];
  fixtures?: Record<string, Record<string, unknown>>;
  previews?: Record<string, unknown>;
  react?: { wrap?: (children: any) => any };
  vue?: { setup?: (app: any) => void };
  pageProps?: Record<string, unknown>;
};

export type FrameworkMount = {
  update: (props: Record<string, unknown>) => void;
  unmount: () => void;
};
