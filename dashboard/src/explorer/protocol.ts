import type { CatalogComponent, LintFinding } from "../types/report";

export const PREVIEW_PROTOCOL = "dslinter-preview-v1";
export type PreviewProvenance = "override" | "usage" | "recipe" | "generated";
export type PreviewCommand = {
  protocol: typeof PREVIEW_PROTOCOL;
  type: "mount" | "update" | "unmount" | "scan-a11y";
  component?: CatalogComponent;
  catalog?: CatalogComponent[];
  values?: Record<string, unknown>;
  explicitKeys?: string[];
  compact?: boolean;
  theme?: "light" | "dark";
  requestId?: string;
};
export type PreviewResponse = {
  protocol: typeof PREVIEW_PROTOCOL;
  type: "ready" | "rendered" | "error" | "event" | "resize" | "a11y";
  provenance?: PreviewProvenance;
  message?: string;
  failurePhase?: "connect" | "render" | "update";
  attempts?: string[];
  revealedValues?: Record<string, string | boolean>;
  suppliedProviders?: import("../types/report").ProviderCandidate[];
  contextDiagnostic?: import("./providerRecovery").ContextDiagnostic;
  adapterExample?: string;
  setupAction?: "notification";
  event?: string;
  value?: unknown;
  snippet?: string;
  substitutedContext?: boolean;
  synthetic?: boolean;
  styles?: string[];
  controls?: import("../types/controls").PlaygroundControl[];
  values?: Record<string, string | number | boolean>;
  height?: number;
  requestId?: string;
  findings?: LintFinding[];
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
  update: (props: Record<string, unknown>) => void | Promise<void>;
  unmount: () => void;
};
