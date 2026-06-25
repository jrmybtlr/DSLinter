/** Hardcoded marketing hex instead of tokens — triggers token-hardcoded-color. */
export function FlashBanner({ children }) {
    return (<div className="rounded-lg px-4 py-3 text-[#ffffff]" style={{ backgroundColor: "#ff0066" }}>
      {children}
    </div>);
}
