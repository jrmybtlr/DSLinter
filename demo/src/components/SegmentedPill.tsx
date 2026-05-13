
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
      className={`rounded px-3 py-1 text-sm ${active ? "bg-gray-900 text-white" : "bg-gray-200"}`}
    >
      {children}
    </button>
  );
}
