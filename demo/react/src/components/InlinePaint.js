/** Inline hex styles — token-hardcoded-color + drift from Tailwind theme. */
export function InlinePaint({ children }) {
    return (<div className="rounded-md p-4" style={{
            backgroundColor: "#00ff99",
            color: "#333333",
            border: "2px solid #9933ff",
        }}>
      {children}
    </div>);
}
