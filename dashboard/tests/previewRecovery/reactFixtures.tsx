import { createContext, useContext, useState, type ReactNode } from "react";
const Context = createContext<string | null>(null);
export function TestProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value="provided">{children}</Context.Provider>;
}
export function NeedsContext({ label = "React ready" }: { label?: string }) {
  const context = useContext(Context);
  if (!context) throw new Error("useTest must be used within a TestProvider.");
  return (
    <button>
      {label}: {context}
    </button>
  );
}
export function UpdateFailure({ fail }: { fail?: boolean }) {
  if (fail) throw new Error("useTest must be used within a TestProvider.");
  return <span>Ready for update</span>;
}

export function VisibilityGate({ showContent = false }: { showContent?: boolean }) {
  return showContent ? <span>Revealed content</span> : null;
}
export default TestProvider;

export function EmptyComponent() {
  return null;
}
export function UnrelatedFailure() {
  throw new Error("Unexpected demo failure");
}

export function ViewportFill() {
  const [reached, setReached] = useState(false);
  return (
    <div style={{ minHeight: "100svh", padding: 32, display: "flex", flexDirection: "column" }}>
      <span>Viewport-sized preview</span>
      <button style={{ marginTop: "auto" }} onClick={() => setReached(true)}>
        {reached ? "Bottom reached" : "Bottom action"}
      </button>
    </div>
  );
}

export const manualDefinition = {
  playgroundControls: [{ key: "label", type: "string", label: "Label", default: "Manual default" }],
  PlaygroundPreview: ({ values }: { values: Record<string, unknown> }) => (
    <span>{String(values.label || "")}</span>
  ),
};
