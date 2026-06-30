import type { ReactNode } from "react";

type ContentCardProps = {
  title: string;
  children: ReactNode;
};

/** Card shell using semantic surface tokens. */
export function ContentCard({ title, children }: ContentCardProps) {
  return (
    <article className="rounded-ds-lg border border-surface-border bg-surface-elevated p-layout-md shadow-xs">
      <h3 className="mb-layout-sm text-lg font-semibold text-foreground">{title}</h3>
      <div className="text-sm text-muted-foreground">{children}</div>
    </article>
  );
}
