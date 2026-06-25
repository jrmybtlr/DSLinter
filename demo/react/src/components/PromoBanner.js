/** Marketing strip using hardcoded hex instead of design tokens. */
export function PromoBanner({ children }) {
    return (<div className="rounded-lg px-4 py-3 text-[#ffffff]" style={{ backgroundColor: "#dc2626" }}>
      {children}
    </div>);
}
