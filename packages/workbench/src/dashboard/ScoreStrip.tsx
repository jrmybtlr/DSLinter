import type { GovernanceScores } from "../types/report";

export function ScoreStrip({ scores }: { scores: GovernanceScores }) {
  const items: { label: string; value: number }[] = [
    { label: "System health", value: scores.design_system_health },
    { label: "UX consistency", value: scores.ux_consistency },
    { label: "Accessibility", value: scores.accessibility },
    { label: "Maintainability", value: scores.maintainability },
  ];

  return (
    <section className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/30 p-1 md:grid-cols-4">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-lg border border-border bg-card px-4 py-3 text-card-foreground shadow-xs"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
        </div>
      ))}
    </section>
  );
}
