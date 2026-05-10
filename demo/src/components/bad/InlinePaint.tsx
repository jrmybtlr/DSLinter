import { definePlayground } from "@dslint/workbench";

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

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(InlinePaint, {
  section: "bad",
  description: "Inline hex styles — token-hardcoded-color and drift from the Tailwind theme.",
  controls: [{ key: "text", label: "Inner text", type: "string", default: "Inline hex panel" }],
  props: (values) => ({ children: String(values.text) }),
});
