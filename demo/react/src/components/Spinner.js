const sizeClass = {
    sm: "size-4 border-2",
    md: "size-8 border-2",
    lg: "size-12 border-[3px]",
};
/** Inline loading spinner with required accessible name. */
export function Spinner({ label, size = "md" }) {
    const s = size in sizeClass ? size : "md";
    return (<span role="status" className="inline-flex items-center gap-2 text-primary">
      <span className={`inline-block animate-spin rounded-full border-current border-t-transparent ${sizeClass[s]}`} aria-hidden/>
      <span className="sr-only">{label}</span>
    </span>);
}
