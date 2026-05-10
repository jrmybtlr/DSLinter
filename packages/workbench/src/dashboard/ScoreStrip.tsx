import type { GovernanceScores } from "../types/report";

export function ScoreStrip({ scores }: { scores: GovernanceScores }) {
  const items: { label: string; value: number }[] = [
    { label: "System health", value: scores.design_system_health },
    { label: "UX consistency", value: scores.ux_consistency },
    { label: "Accessibility", value: scores.accessibility },
    { label: "Maintainability", value: scores.maintainability },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(({ label, value }) => (
        <div key={label} className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
        </div>
      ))}
    </section>
  );
}
