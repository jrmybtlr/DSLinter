import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

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

export const playgroundMeta: PlaygroundMeta = {
  id: "InconsistentToggle",
  title: "InconsistentToggle",
  section: "bad",
  description: "API uses `pressedTone` instead of the `tone` / `variant` pattern used elsewhere.",
};

export const playgroundControls: PlaygroundControl[] = [
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
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  const pressed = values.pressedTone === "off" ? "off" : "on";
  return (
    <InconsistentToggle pressedTone={pressed}>{String(values.label)}</InconsistentToggle>
  );
}
