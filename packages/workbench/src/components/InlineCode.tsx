import type { ReactNode } from "react";

export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="text-xs text-muted-foreground">{children}</code>;
}
