import { Badge } from "./ui/badge";
import { EmptyCard } from "./EmptyCard";
import type { WorkspaceReport } from "../types/report";
import { implementationClassFrequenciesForComponent } from "../dashboard/aggregate";

export function ComponentImplementationClasses({
  report,
  componentName,
}: {
  report: WorkspaceReport | null | undefined;
  componentName: string;
}) {
  if (!report) {
    return (
      <EmptyCard message="Load the DSLinter report to see implementation classes." />
    );
  }

  const frequencies = implementationClassFrequenciesForComponent(
    report,
    componentName,
  );
  const tokens = Object.entries(frequencies).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  if (tokens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No class strings captured in this component&apos;s JSX implementation.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tokens.map(([token, count]) => (
        <Badge key={token} variant="secondary" size="sm" className="font-mono">
          {token}
          {count > 1 ? (
            <span className="ml-1 tabular-nums text-muted-foreground">×{count}</span>
          ) : null}
        </Badge>
      ))}
    </div>
  );
}
