const variantClass = {
    primary: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline-primary",
    secondary: "border border-surface-border bg-surface-elevated text-gray-800 shadow-xs hover:bg-gray-50 focus-visible:outline-gray-400",
    danger: "bg-danger text-danger-foreground shadow-xs hover:bg-danger/90 focus-visible:outline-danger",
    success: "bg-success text-success-foreground shadow-xs hover:bg-success/90 focus-visible:outline-success",
    warning: "bg-warning text-warning-foreground shadow-xs hover:bg-warning/90 focus-visible:outline-warning",
    ghost: "bg-transparent text-gray-800 hover:bg-gray-100 focus-visible:outline-gray-400",
};
const sizeClass = {
    sm: "px-layout-sm py-1 text-xs",
    md: "px-layout-md py-layout-xs text-sm",
};
/** Button with semantic variants mapped to theme tokens. */
export function SemanticButton({ children, variant = "primary", size = "md", type = "button", disabled = false, isLoading = false, }) {
    const v = variant in variantClass ? variant : "primary";
    const s = size in sizeClass ? size : "md";
    const busy = isLoading && !disabled;
    return (<button type={type} disabled={disabled || busy} aria-busy={busy || undefined} className={`inline-flex items-center justify-center gap-1.5 rounded-ds font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantClass[v]} ${sizeClass[s]}`}>
      {busy ? (<span className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden/>) : null}
      <span className={busy ? "opacity-90" : undefined}>{children}</span>
      {busy ? <span className="sr-only">Loading</span> : null}
    </button>);
}
