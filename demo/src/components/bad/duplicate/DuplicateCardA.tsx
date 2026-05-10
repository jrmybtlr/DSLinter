import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

/** Intentional duplicate component name — triggers duplicate-component in DSLint. */
export function Card() {
  return (
    <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
      <p className="font-medium">Alex Morgan</p>
      <p className="text-blue-800/90">Engineering · Remote</p>
    </div>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "DuplicateCardA",
  title: "Card (team member)",
  section: "bad",
  description: "Duplicate export name `Card` with DuplicateCardB — duplicate-component in DSLint.",
};

export const playgroundControls: PlaygroundControl[] = [];

export function PlaygroundPreview(_props: PlaygroundPreviewProps) {
  return <Card />;
}
