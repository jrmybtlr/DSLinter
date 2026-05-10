import { definePlayground } from "@dslint/workbench";

type Props = {
  label: string;
};

/** Named in `.dslint.json` deprecated_components — triggers deprecated-component rule. */
export function DeprecatedChip({ label }: Props) {
  return (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">{label}</span>
  );
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(DeprecatedChip, {
  section: "bad",
  title: "Deprecated tag",
  description: "Listed in `.dslint.json` deprecated_components — triggers deprecated-component rule.",
  controls: [{ key: "label", label: "Chip label", type: "string", default: "Beta" }],
  props: (values) => ({ label: String(values.label) }),
});
