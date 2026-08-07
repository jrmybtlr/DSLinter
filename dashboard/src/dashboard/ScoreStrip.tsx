import type { GovernanceScores } from "../types/report";

export function ScoreStrip({ scores }: { scores: GovernanceScores }) {
  const items: { label: string; value: number }[] = [
    { label: "System health", value: scores.design_system_health },
    { label: "UX consistency", value: scores.ux_consistency },
    { label: "Accessibility", value: scores.accessibility },
    { label: "Maintainability", value: scores.maintainability },
  ];
  if (scores.token_adoption != null) {
    items.push({ label: "Token adoption", value: scores.token_adoption });
  }

  const cols = items.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-5";

  return (
    <section className={`grid divide-x divide-border border-b bg-white ${cols}`}>
      {items.map(({ label, value }) => (
        <div key={label} className="px-6 py-8 text-center text-card-foreground shadow-xs">
          <p className="text-xs font-medium tracking-wide text-muted-foreground/70 uppercase">
            {label}
          </p>
          <p className="mt-1.5 text-4xl font-semibold text-foreground tabular-nums">{value}</p>
        </div>
      ))}
    </section>
  );
}
