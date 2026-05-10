import type { PlaygroundControl, PlaygroundMeta, PlaygroundPreviewProps } from "@dslint/workbench";

type Props = {
  /** Inconsistent API: elsewhere we use `tone` / `variant`; this uses `pressedTone`. */
  pressedTone: "on" | "off";
  children: React.ReactNode;
};

/** Filter-style control with a prop name that doesn’t match the rest of the kit. */
export function SegmentedPill({ pressedTone, children }: Props) {
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
  id: "SegmentedPill",
  title: "Segmented pill",
  section: "bad",
  description: "Uses `pressedTone` instead of the `tone` / `variant` pattern used elsewhere.",
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
  { key: "label", label: "Label", type: "string", default: "Unread only" },
];

export function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
  const pressed = values.pressedTone === "off" ? "off" : "on";
  return (
    <SegmentedPill pressedTone={pressed}>{String(values.label)}</SegmentedPill>
  );
}
