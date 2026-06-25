const variantClass = {
    info: "border-primary/30 bg-primary/5 text-gray-900",
    success: "border-success/30 bg-success/5 text-gray-900",
    warning: "border-warning/40 bg-warning/10 text-gray-900",
    danger: "border-danger/40 bg-danger/5 text-gray-900",
};
const roleForVariant = {
    info: "status",
    success: "status",
    warning: "alert",
    danger: "alert",
};
/** Inline message block for page-level feedback. */
export function InlineAlert({ children, variant = "info", title }) {
    const v = variant in variantClass ? variant : "info";
    return (<div role={roleForVariant[v]} className={`rounded-ds border px-layout-sm py-layout-xs text-sm ${variantClass[v]}`}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="text-gray-800 [&_p]:m-0 [&_p+_p]:mt-2">{children}</div>
    </div>);
}
