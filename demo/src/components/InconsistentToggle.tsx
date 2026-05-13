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
      className={`rounded px-3 py-1 text-sm ${active ? "bg-gray-900 text-white" : "bg-gray-200"}`}
    >
      {children}
    </button>
  );
}
