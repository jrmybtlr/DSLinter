const toneClass = {
    neutral: "bg-gray-100 text-gray-800 border-surface-border",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    danger: "bg-danger/10 text-danger border-danger/30",
};
/** Small status pill with constrained variants. */
export function StatusBadge({ children, tone = "neutral" }) {
    return (<span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}>
      {children}
    </span>);
}
