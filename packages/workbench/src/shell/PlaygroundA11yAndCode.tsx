import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type { PlaygroundEntry } from "../types/playground";
import type { A11yModuleSummary } from "../report/a11yForModule";
import type { CodeScoreModuleSummary } from "../report/codeScoreForModule";
import type { LintFinding, UsageSummary } from "../types/report";
import { controlsToApiRows } from "./controlApiTable";
import { PlaygroundUsageCode } from "./PlaygroundUsageCode";

const sectionTitleClass = "text-lg font-semibold tracking-tight text-gray-900";
const sectionDescClass = "mt-1 text-sm text-gray-600";

type UsageProps = {
  entry: PlaygroundEntry;
  values: PlaygroundArgs;
};

export function PlaygroundUsageSection({ entry, values }: UsageProps) {
  const usage =
    entry.usageSnippet?.(values) ??
    `// Pass usageSnippet on this PlaygroundEntry, or derive snippets from dslint controls.\n<${entry.id} />`;

  return (
    <section id="usage" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>Usage</h2>
      <p className={sectionDescClass}>Example import-style usage for the current playground values.</p>
      <PlaygroundUsageCode source={usage} />
    </section>
  );
}

type TokenStyleProps = {
  findings: LintFinding[];
  reportReady: boolean;
};

export function PlaygroundTokenStyleSection({ findings, reportReady }: TokenStyleProps) {
  return (
    <section id="design-tokens" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>Design tokens and colors</h2>
      <p className={sectionDescClass}>
        <span className="font-mono text-[13px]">token-*</span> findings for this file from{" "}
        <span className="font-mono text-[13px]">dslint-report.json</span> (hardcoded colors, Tailwind arbitrary values).
        Regenerate the report after edits.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-xs">
        {reportReady && findings.length > 0 ? (
          <table className="w-full min-w-[28rem] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80">
                <th className="px-3 py-2.5 font-semibold text-gray-700">Rule</th>
                <th className="w-16 px-3 py-2.5 font-semibold text-gray-700">Line</th>
                <th className="px-3 py-2.5 font-semibold text-gray-700">Severity</th>
                <th className="px-3 py-2.5 font-semibold text-gray-700">Message</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {findings.map((f, i) => (
                <tr key={`${f.rule_id}-${f.line ?? "x"}-${i}`} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2.5 font-mono text-[11px] text-gray-900">{f.rule_id}</td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-gray-600">{f.line ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[12px] capitalize text-gray-600">{f.severity}</td>
                  <td className="px-3 py-2.5 text-gray-700">{f.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : reportReady && findings.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            No hardcoded or arbitrary token color findings on this file in the current report.
          </p>
        ) : (
          <p className="p-4 text-sm text-gray-500">
            Token findings update when <span className="font-mono">dslint-report.json</span> is available (same fetch as
            Governance).
          </p>
        )}
      </div>
    </section>
  );
}

type CodeScoreProps = {
  codeScore: CodeScoreModuleSummary;
  reportReady: boolean;
};

export function PlaygroundCodeScoreSection({ codeScore, reportReady }: CodeScoreProps) {
  const { findings } = codeScore;
  const scoreTone =
    codeScore.score >= 85
      ? "text-emerald-800 bg-emerald-50 border-emerald-200"
      : codeScore.score >= 60
        ? "text-amber-900 bg-amber-50 border-amber-200"
        : "text-red-900 bg-red-50 border-red-200";

  return (
    <section id="code-score" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>Code score</h2>
      <p className={sectionDescClass}>
        Heuristic quality checks on this file (rule ids use the <span className="font-mono text-[13px]">smell-*</span>{" "}
        prefix in <span className="font-mono text-[13px]">dslint-report.json</span>) — they feed repo maintainability.
        Regenerate the report after edits.
      </p>
      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1" />
          <div className={`shrink-0 rounded-lg border px-3 py-2 text-center ${scoreTone}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Code score</p>
            <p className="text-2xl font-bold tabular-nums">{reportReady ? codeScore.score : "—"}</p>
            {reportReady ? (
              <p className="mt-0.5 text-[10px] opacity-90">
                {codeScore.issueCount} finding{codeScore.issueCount === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="mt-0.5 max-w-40 text-[10px] opacity-90">Load report…</p>
            )}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-md border border-gray-100">
          {reportReady && findings.length > 0 ? (
            <table className="w-full min-w-72 border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-3 py-2.5 font-semibold text-gray-700">Rule</th>
                  <th className="w-16 px-3 py-2.5 font-semibold text-gray-700">Line</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700">Severity</th>
                  <th className="px-3 py-2.5 font-semibold text-gray-700">Message</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {findings.map((f, i) => (
                  <tr key={`${f.rule_id}-${f.line ?? "x"}-${i}`} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2.5 font-mono text-[11px] text-gray-900">{f.rule_id}</td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-gray-600">{f.line ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[12px] capitalize text-gray-600">{f.severity}</td>
                    <td className="px-3 py-2.5 text-gray-700">{f.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportReady && findings.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No quality findings on this file in the current report.</p>
          ) : (
            <p className="p-4 text-sm text-gray-500">
              Code score updates when <span className="font-mono">dslint-report.json</span> is available (same fetch as
              Governance).
            </p>
          )}
        </div>
      </div>
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
      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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
          <ul className="mt-4 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 text-xs">
            {a11y.findings.map((f, i) => (
              <li key={`${f.rule_id}-${i}`} className="flex flex-col gap-0.5 px-2 py-2 sm:flex-row sm:justify-between">
                <span className="font-mono text-[10px] text-gray-600">{f.rule_id}</span>
                <span className="text-gray-800">{f.message}</span>
                {f.line != null ? (
                  <span className="shrink-0 font-mono text-[10px] text-gray-400">:{f.line}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : reportReady && a11y.issueCount === 0 ? (
          <p className="mt-4 text-xs text-gray-500">No accessibility findings on this file in the current report.</p>
        ) : (
          <p className="mt-4 text-xs text-gray-500">
            A11y score updates when <span className="font-mono">dslint-report.json</span> is available (same fetch as Governance).
          </p>
        )}
      </div>
    </section>
  );
}

type ApiProps = {
  controls: PlaygroundControl[];
  /** When set, adds columns for how often each prop appears at scanned JSX call sites. */
  reportUsage?: UsageSummary;
  /** Declared prop names from the scan (definitions + playground specs), used for “never passed” hints. */
  declaredPropsFromScan?: string[];
  /** True when `dslint-report.json` is loaded (even if this component has no usage row). */
  governanceReportLoaded?: boolean;
};

function formatRepoLiteralChips(byVal: Record<string, number> | undefined, max = 6): string {
  if (!byVal || Object.keys(byVal).length === 0) return "—";
  const entries = Object.entries(byVal).sort((x, y) => y[1] - x[1]);
  const shown = entries.slice(0, max);
  const tail = Math.max(0, entries.length - max);
  return shown.map(([val, n]) => `${JSON.stringify(val)} ×${n}`).join(" · ") + (tail > 0 ? ` · +${tail}` : "");
}

export function PlaygroundApiReference({
  controls,
  reportUsage,
  declaredPropsFromScan = [],
  governanceReportLoaded = false,
}: ApiProps) {
  if (controls.length === 0) return null;

  const rows = controlsToApiRows(controls);
  const showRepo = reportUsage != null;
  const freqs = reportUsage?.prop_frequencies ?? {};
  const valueFreqs = reportUsage?.prop_value_frequencies ?? {};
  const controlKeys = new Set(rows.map((r) => r.prop));
  const extraRepoProps = showRepo
    ? Object.keys(freqs)
        .filter((k) => !controlKeys.has(k))
        .sort((a, b) => a.localeCompare(b))
    : [];

  const neverPassedDeclared =
    showRepo && declaredPropsFromScan.length > 0
      ? declaredPropsFromScan.filter((p) => controlKeys.has(p) && (freqs[p] ?? 0) === 0)
      : [];

  return (
    <section id="api-reference" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>API reference</h2>
      <p className={sectionDescClass}>
        Playground controls and their mapped types.
        {showRepo
          ? " The last columns summarize how each prop appears across scanned JSX in the repo (call-site counts and literal values only)."
          : governanceReportLoaded
            ? " No JSX usage was recorded for this component in the current report, so repo adoption columns are omitted."
            : " Load dslint-report.json to add repo call-site and literal columns for each prop."}
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-xs">
        <table className="w-full min-w-[36rem] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th className="px-3 py-2.5 font-semibold text-gray-700">Prop</th>
              <th className="px-3 py-2.5 font-semibold text-gray-700">Type</th>
              <th className="px-3 py-2.5 font-semibold text-gray-700">Default</th>
              <th className="px-3 py-2.5 font-semibold text-gray-700">Description</th>
              {showRepo ? (
                <>
                  <th className="w-28 px-3 py-2.5 font-semibold text-gray-700">Repo call sites</th>
                  <th className="min-w-[14rem] px-3 py-2.5 font-semibold text-gray-700">Repo literals</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody className="text-gray-800">
            {rows.map((r) => {
              const n = showRepo ? (freqs[r.prop] ?? 0) : 0;
              const unusedAtRepo = showRepo && declaredPropsFromScan.includes(r.prop) && n === 0;
              return (
                <tr key={r.prop} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2.5 font-mono text-[12px] text-gray-900">{r.prop}</td>
                  <td className="max-w-[12rem] px-3 py-2.5 font-mono text-[11px] text-gray-600">{r.type}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-gray-600">{r.default}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.description}</td>
                  {showRepo ? (
                    <>
                      <td
                        className={`px-3 py-2.5 font-mono text-[12px] tabular-nums ${unusedAtRepo ? "text-gray-400" : "text-gray-700"}`}
                        title={unusedAtRepo ? "Declared in the scanned component but not passed at any captured call site" : undefined}
                      >
                        ×{n}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] leading-snug text-gray-600">
                        {formatRepoLiteralChips(valueFreqs[r.prop])}
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showRepo && neverPassedDeclared.length > 0 ? (
        <div className="mt-3 rounded-md border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-[12px] text-amber-950">
          <span className="font-semibold">Declared but never passed in repo: </span>
          <span className="font-mono text-[11px]">{neverPassedDeclared.join(", ")}</span>
        </div>
      ) : null}

      {showRepo && extraRepoProps.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-800">Also seen in repo (not in playground)</h3>
          <p className="mt-1 text-xs text-gray-600">
            These prop names appear in scanned JSX but are not wired as playground controls on this page.
          </p>
          <div className="mt-2 overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="w-full min-w-[28rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-3 py-2.5 font-semibold text-gray-700">Prop</th>
                  <th className="w-28 px-3 py-2.5 font-semibold text-gray-700">Repo call sites</th>
                  <th className="min-w-[14rem] px-3 py-2.5 font-semibold text-gray-700">Repo literals</th>
                </tr>
              </thead>
              <tbody>
                {extraRepoProps.map((prop) => (
                  <tr key={prop} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2.5 font-mono text-[12px] text-gray-900">{prop}</td>
                    <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums text-gray-700">×{freqs[prop] ?? 0}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-gray-600">{formatRepoLiteralChips(valueFreqs[prop])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
