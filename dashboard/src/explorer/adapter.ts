export type { PreviewAdapter } from "./protocol";

/** Props passed to a `preview()` decorate callback. `node` is the target with live controls. */
export type PreviewDecorateProps = { node: unknown };

export type PreviewDefinition = {
  readonly __dslinterPreview: true;
  readonly component: unknown;
  readonly decorate?: (props: PreviewDecorateProps) => unknown;
};

/** Bind a component to explorer controls and optionally wrap or decorate the mounted node. */
export function preview(
  component: unknown,
  decorate?: (props: PreviewDecorateProps) => unknown,
): PreviewDefinition {
  return { __dslinterPreview: true, component, decorate };
}

export function isPreviewDefinition(value: unknown): value is PreviewDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as PreviewDefinition).__dslinterPreview === true &&
    "component" in value
  );
}
