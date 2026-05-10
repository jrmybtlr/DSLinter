import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
};

/** Inline hex styles — token-hardcoded-color + drift from Tailwind theme. */
export function InlinePaint({ children }: Props) {
  return (
    <div
      className="rounded-md p-4"
      style={{
        backgroundColor: "#00ff99",
        color: "#333333",
        border: "2px solid #9933ff",
      }}
    >
      {children}
    </div>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "InlinePaint",
  title: "InlinePaint",
  section: "bad",
  description: "Inline hex styles — token-hardcoded-color and drift from the Tailwind theme.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "text", label: "Inner text", type: "string", default: "Inline hex panel" },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return <InlinePaint>{String(values.text)}</InlinePaint>;
}
