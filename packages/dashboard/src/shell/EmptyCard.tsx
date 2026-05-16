import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function EmptyCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
