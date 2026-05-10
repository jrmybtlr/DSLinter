import { definePlayground } from "@dslint/workbench";

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

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(LegacyButton, {
  section: "bad",
  title: "Legacy button",
  description: "@deprecated — arbitrary Tailwind color still referenced in the app.",
  controls: [{ key: "label", label: "Button label", type: "string", default: "Continue" }],
  props: (values) => ({ children: String(values.label) }),
});
