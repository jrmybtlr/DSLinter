import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function Section({
  id,
  className,
  children,
  title,
  description,
  actions,
}: {
  id: string;
  className?: string;
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg/none font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="text-sm mt-1.5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
