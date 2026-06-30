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
