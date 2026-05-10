import { definePlayground } from "@dslint/workbench";

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

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(CalloutPanel, {
  section: "bad",
  title: "Callout panel",
  description: "Inline hex styles — token-hardcoded-color and drift from the Tailwind theme.",
  controls: [
    {
      key: "text",
      label: "Body text",
      type: "string",
      default: "This project is due Friday. Please review the checklist.",
    },
  ],
  props: (values) => ({ children: String(values.text) }),
});
