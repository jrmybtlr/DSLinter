import type { GovernanceScores } from "../types/report";

export function ScoreStrip({ scores }: { scores: GovernanceScores }) {
  const items: { label: string; value: number }[] = [
    { label: "System health", value: scores.design_system_health },
    { label: "UX consistency", value: scores.ux_consistency },
    { label: "Accessibility", value: scores.accessibility },
    { label: "Maintainability", value: scores.maintainability },
  ];

  return (
    <section className="grid grid-cols-2 divide-x divide-border border-b md:grid-cols-4">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="px-6 py-8 text-center text-card-foreground shadow-xs"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
            {label}
          </p>
          <p className="mt-1.5 text-4xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
        </div>
      ))}
    </section>
  );
}
