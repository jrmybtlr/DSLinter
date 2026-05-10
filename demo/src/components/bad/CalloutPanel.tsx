import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

type Props = {
  children: React.ReactNode;
};

/** Inline hex styles from a one-off mockup — drifts from the Tailwind theme. */
export function CalloutPanel({ children }: Props) {
  return (
    <div
      className="rounded-md p-4"
      style={{
        backgroundColor: "#f1f5f9",
        color: "#334155",
        border: "1px solid #cbd5e1",
      }}
    >
      {children}
    </div>
  );
}

export const playgroundMeta: PlaygroundMeta = {
  id: "CalloutPanel",
  title: "Callout panel",
  section: "bad",
  description: "Inline hex styles — token-hardcoded-color and drift from the Tailwind theme.",
};

export const playgroundControls: PlaygroundControl[] = [
  { key: "text", label: "Body text", type: "string", default: "This project is due Friday. Please review the checklist." },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  return <CalloutPanel>{String(values.text)}</CalloutPanel>;
}
