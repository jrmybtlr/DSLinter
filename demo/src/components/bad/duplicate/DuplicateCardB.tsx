import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

/** Same export name as DuplicateCardA — duplicate definition signal. */
export function Card() {
  return (
    <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
      <p className="font-medium">Order #1042</p>
      <p className="text-rose-800/90">Shipped · Arrives Thu</p>
    </div>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "DuplicateCardB",
  title: "Card (order)",
  section: "bad",
  description: "Same export name as DuplicateCardA — duplicate definition signal.",
};

export const playgroundControls: PlaygroundControl[] = [];

export function PlaygroundPreview(_props: PlaygroundPreviewProps) {
  return <Card />;
}
