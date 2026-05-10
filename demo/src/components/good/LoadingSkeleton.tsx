import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

/** Predictable loading placeholder blocks. */
export function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-layout-sm rounded-ds border border-surface-border bg-surface-elevated p-layout-md">
      <div className="h-4 w-2/3 rounded bg-slate-200" />
      <div className="h-4 w-full rounded bg-slate-200" />
      <div className="h-4 w-5/6 rounded bg-slate-200" />
    </div>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "LoadingSkeleton",
  title: "LoadingSkeleton",
  section: "good",
  description: "Predictable loading placeholder blocks.",
};

export const playgroundControls: PlaygroundControl[] = [];

export function PlaygroundPreview(_props: PlaygroundPreviewProps) {
  return <LoadingSkeleton />;
}
