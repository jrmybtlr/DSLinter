/** Inline code styled from palette, not raw hex in JSX. */
export function InlineCode({ children }) {
    return (<code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800 ring-1 ring-surface-border">
      {children}
    </code>);
}
