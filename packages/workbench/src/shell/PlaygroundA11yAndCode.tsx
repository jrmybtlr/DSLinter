import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type { PlaygroundEntry } from "../types/playground";
import type { A11yModuleSummary } from "../report/a11yForModule";
import { controlsToApiRows } from "./controlApiTable";

const sectionTitleClass = "text-lg font-semibold tracking-tight text-slate-900";
const sectionDescClass = "mt-1 text-sm text-slate-600";

type UsageProps = {
  entry: PlaygroundEntry;
  values: PlaygroundArgs;
};

export function PlaygroundUsageSection({ entry, values }: UsageProps) {
  const usage =
    entry.usageSnippet?.(values) ??
    `// Add usageSnippet on this playground entry, or extend demo/playground/usageSnippets.ts\n<${entry.id} /* map values.* to props */ />`;

  return (
    <section id="usage" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>Usage</h2>
      <p className={sectionDescClass}>Example import-style usage for the current playground values.</p>
      <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-[13px] leading-relaxed text-slate-100 shadow-sm">
        <code>{usage}</code>
      </pre>
    </section>
  );
}

type A11yProps = {
  a11y: A11yModuleSummary;
  reportReady: boolean;
};

export function PlaygroundA11ySection({ a11y, reportReady }: A11yProps) {
  const scoreTone =
    a11y.score >= 85 ? "text-emerald-800 bg-emerald-50 border-emerald-200" : a11y.score >= 60 ? "text-amber-900 bg-amber-50 border-amber-200" : "text-red-900 bg-red-50 border-red-200";

  return (
    <section id="accessibility" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>Accessibility</h2>
      <p className={sectionDescClass}>
        Score from <span className="font-mono text-[13px]">a11y-*</span> findings on this file in{" "}
        <span className="font-mono text-[13px]">dslint-report.json</span>. Regenerate the report after edits.
      </p>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1" />
          <div className={`shrink-0 rounded-lg border px-3 py-2 text-center ${scoreTone}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">A11y score</p>
            <p className="text-2xl font-bold tabular-nums">{reportReady ? a11y.score : "—"}</p>
            {reportReady ? (
              <p className="mt-0.5 text-[10px] opacity-90">{a11y.issueCount} issue{a11y.issueCount === 1 ? "" : "s"}</p>
            ) : (
              <p className="mt-0.5 max-w-[10rem] text-[10px] opacity-90">Load report…</p>
            )}
          </div>
        </div>
        {reportReady && a11y.findings.length > 0 ? (
          <ul className="mt-4 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-100 bg-slate-50 text-xs">
            {a11y.findings.map((f, i) => (
              <li key={`${f.rule_id}-${i}`} className="flex flex-col gap-0.5 px-2 py-2 sm:flex-row sm:justify-between">
                <span className="font-mono text-[10px] text-slate-600">{f.rule_id}</span>
                <span className="text-slate-800">{f.message}</span>
                {f.line != null ? (
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">:{f.line}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : reportReady && a11y.issueCount === 0 ? (
          <p className="mt-4 text-xs text-slate-500">No accessibility findings on this file in the current report.</p>
        ) : (
          <p className="mt-4 text-xs text-slate-500">
            A11y score updates when <span className="font-mono">dslint-report.json</span> is available (same fetch as Governance).
          </p>
        )}
      </div>
    </section>
  );
}

type ApiProps = {
  controls: PlaygroundControl[];
};

export function PlaygroundApiReference({ controls }: ApiProps) {
  if (controls.length === 0) return null;

  const rows = controlsToApiRows(controls);

  return (
    <section id="api-reference" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>API reference</h2>
      <p className={sectionDescClass}>Playground controls and their mapped types. Wire these to your component props as needed.</p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[32rem] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-3 py-2.5 font-semibold text-slate-700">Prop</th>
              <th className="px-3 py-2.5 font-semibold text-slate-700">Type</th>
              <th className="px-3 py-2.5 font-semibold text-slate-700">Default</th>
              <th className="px-3 py-2.5 font-semibold text-slate-700">Description</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {rows.map((r) => (
              <tr key={r.prop} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-2.5 font-mono text-[12px] text-slate-900">{r.prop}</td>
                <td className="max-w-[12rem] px-3 py-2.5 font-mono text-[11px] text-slate-600">{r.type}</td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">{r.default}</td>
                <td className="px-3 py-2.5 text-slate-600">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
