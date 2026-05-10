import { definePlayground } from "@dslint/workbench";

type Props = {
  /** Inconsistent API: elsewhere we use `tone` or `variant`; this uses `pressedTone`. */
  pressedTone: "on" | "off";
  children: React.ReactNode;
};

/** API inconsistency example for governance discussions (not auto-flagged yet). */
export function InconsistentToggle({ pressedTone, children }: Props) {
  const active = pressedTone === "on";
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded px-3 py-1 text-sm ${active ? "bg-slate-900 text-white" : "bg-slate-200"}`}
    >
      {children}
    </button>
  );
}

export const { playgroundMeta, playgroundControls, PlaygroundPreview } = definePlayground(InconsistentToggle, {
  section: "bad",
  description: "API uses `pressedTone` instead of the `tone` / `variant` pattern used elsewhere.",
  controls: [
    {
      key: "pressedTone",
      label: "pressedTone",
      type: "select",
      default: "on",
      options: [
        { value: "on", label: "on" },
        { value: "off", label: "off" },
      ],
    },
    { key: "label", label: "Button text", type: "string", default: "Inconsistent prop naming" },
  ],
  props: (values): Props => ({
    pressedTone: values.pressedTone === "off" ? "off" : "on",
    children: String(values.label),
  }),
});
