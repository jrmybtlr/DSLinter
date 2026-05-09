type Props = {
  children: React.ReactNode;
};

/** @deprecated Example only — DSLint flags via `.dslint.json`. Uses one-off colors. */
export function LegacyButton({ children }: Props) {
  return (
    <button
      type="button"
      className="rounded-md bg-[#7c3aed] px-4 py-2 text-white shadow-[0_0_20px_#c084fc]"
    >
      {children}
    </button>
  );
}
