import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

type Props = {
  label: string;
};

/** Named in `.dslint.json` deprecated_components — triggers deprecated-component rule. */
export function DeprecatedChip({ label }: Props) {
  return (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">{label}</span>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "DeprecatedChip",
  title: "Deprecated tag",
  section: "bad",
  description: "Listed in `.dslint.json` deprecated_components — triggers deprecated-component rule.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "label", label: "Chip label", type: "string", default: "Beta" },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return <DeprecatedChip label={String(values.label)} />;
}
