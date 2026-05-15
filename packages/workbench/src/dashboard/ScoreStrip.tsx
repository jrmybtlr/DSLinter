import type { GovernanceScores } from "../types/report";

export function ScoreStrip({ scores }: { scores: GovernanceScores }) {
  const items: { label: string; value: number }[] = [
    { label: "System health", value: scores.design_system_health },
    { label: "UX consistency", value: scores.ux_consistency },
    { label: "Accessibility", value: scores.accessibility },
    { label: "Maintainability", value: scores.maintainability },
  ];

  return (
    <section className="grid bg-black/1 p-1 border border-black/5 rounded-xl grid-cols-2 gap-1 md:grid-cols-4">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-xs"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
            {value}
          </p>
        </div>
      ))}
    </section>
  );
}
