import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
};

/** @deprecated Older app shell — DSLint flags via `.dslint.json`. Uses one-off colors. */
export function LegacyButton({ children }: Props) {
  return (
    <button type="button" className="rounded-md bg-[#5b21b6] px-4 py-2 text-sm font-medium text-white">
      {children}
    </button>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "LegacyButton",
  title: "Legacy button",
  section: "bad",
  description: "@deprecated — arbitrary Tailwind color still referenced in the app.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "label", label: "Button label", type: "string", default: "Continue" },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return <LegacyButton>{String(values.label)}</LegacyButton>;
}
