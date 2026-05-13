import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type { PlaygroundEntry } from "../types/playground";
import type { A11yModuleSummary } from "../report/a11yForModule";
import type { CodeScoreModuleSummary } from "../report/codeScoreForModule";
import type { LintFinding, UsageSummary } from "../types/report";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
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
      <p className={sectionDescClass}>
        Example import-style usage for the current playground values.
      </p>
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
        <span className="font-mono">token-*</span> findings for this file from{" "}
        <span className="font-mono">dslint-report.json</span> (hardcoded colors, Tailwind arbitrary
        values). Regenerate the report after edits.
      </p>
      <div className="mt-4 rounded-lg border border-border bg-card shadow-xs">
        {reportReady && findings.length > 0 ? (
          <Table className="border-collapse text-left">
            <TableHeader>
              <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                  Rule
                </TableHead>
                <TableHead className="h-auto w-16 px-3 py-2.5 font-semibold text-muted-foreground">
                  Line
                </TableHead>
                <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                  Severity
                </TableHead>
                <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                  Message
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-foreground">
              {findings.map((f, i) => (
                <TableRow
                  key={`${f.rule_id}-${f.line ?? "x"}-${i}`}
                  className="border-border hover:bg-transparent"
                >
                  <TableCell className="px-3 py-2.5 font-mono text-xs">{f.rule_id}</TableCell>
                  <TableCell className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {f.line ?? "—"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-xs capitalize text-muted-foreground">
                    {f.severity}
                  </TableCell>
                  <TableCell className="whitespace-normal px-3 py-2.5 text-muted-foreground">
                    {f.message}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : reportReady && findings.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            No hardcoded or arbitrary token color findings on this file in the current report.
          </p>
        ) : (
          <p className="p-4 text-sm text-gray-500">
            Token findings update when <span className="font-mono">dslint-report.json</span> is
            available (same fetch as Governance).
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

  const scoreBadge = (
    <div className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-center ${scoreTone}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Code score</p>
      <p className="text-xl font-bold tabular-nums leading-tight">
        {reportReady ? codeScore.score : "—"}
      </p>
      {reportReady ? (
        <p className="mt-0.5 text-[10px] opacity-90">
          {codeScore.issueCount} finding{codeScore.issueCount === 1 ? "" : "s"}
        </p>
      ) : (
        <p className="mt-0.5 max-w-40 text-[10px] opacity-90">Load report…</p>
      )}
    </div>
  );

  const hasFindingRows = reportReady && findings.length > 0;

  return (
    <section id="code-score" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>Code score: {reportReady ? codeScore.score : "—"}/100</h2>

      {hasFindingRows ? (
        <>
          <div className="mt-3 rounded-md border border-border">
            <Table className="min-w-72 border-collapse text-left">
              <TableHeader>
                <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                  <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                    Rule
                  </TableHead>
                  <TableHead className="h-auto w-16 px-3 py-2.5 font-semibold text-muted-foreground">
                    Line
                  </TableHead>
                  <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                    Severity
                  </TableHead>
                  <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                    Message
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-foreground">
                {findings.map((f, i) => (
                  <TableRow
                    key={`${f.rule_id}-${f.line ?? "x"}-${i}`}
                    className="border-border hover:bg-transparent"
                  >
                    <TableCell className="px-3 py-2.5 font-mono text-[11px]">{f.rule_id}</TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {f.line ?? "—"}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-xs capitalize text-muted-foreground">
                      {f.severity}
                    </TableCell>
                    <TableCell className="whitespace-normal px-3 py-2.5 text-muted-foreground">
                      {f.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs leading-snug text-gray-500">
            {reportReady && findings.length === 0 ? (
              <>No quality findings on this file in the current report.</>
            ) : (
              <>
                Code score updates when <span className="font-mono">dslint-report.json</span> is
                available (same fetch as Governance).
              </>
            )}
          </p>
          {scoreBadge}
        </div>
      )}
    </section>
  );
}

type A11yProps = {
  a11y: A11yModuleSummary;
  reportReady: boolean;
};

export function PlaygroundA11ySection({ a11y, reportReady }: A11yProps) {
  const hasFindingRows = reportReady && a11y.findings.length > 0;

  return (
    <section id="accessibility" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>Accessibility: {reportReady ? a11y.score : "—"}/100</h2>
      {hasFindingRows ? (
        <>
          <ul className="mt-3 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 text-xs">
            {a11y.findings.map((f, i) => (
              <li
                key={`${f.rule_id}-${i}`}
                className="flex flex-col gap-0.5 px-2 py-2 sm:flex-row sm:justify-between"
              >
                <span className="font-mono text-[10px] text-gray-600">{f.rule_id}</span>
                <span className="text-gray-800">{f.message}</span>
                {f.line != null ? (
                  <span className="shrink-0 font-mono text-[10px] text-gray-400">:{f.line}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="min-w-0 flex-1 text-sm leading-snug text-gray-500 mt-1">
          {reportReady && a11y.issueCount === 0 ? (
            <>No accessibility findings on this file in the current report.</>
          ) : (
            <>
              A11y score updates when <span className="font-mono">dslint-report.json</span> is
              available (same fetch as Governance).
            </>
          )}
        </p>
      )}
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
  return (
    shown.map(([val, n]) => `${JSON.stringify(val)} ×${n}`).join(" · ") +
    (tail > 0 ? ` · +${tail}` : "")
  );
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
      <div className="mt-4 rounded-lg border border-border bg-card shadow-xs">
        <Table className="min-w-[36rem] border-collapse text-left">
          <TableHeader>
            <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
              <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                Prop
              </TableHead>
              <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                Type
              </TableHead>
              <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                Default
              </TableHead>
              <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                Description
              </TableHead>
              {showRepo ? (
                <>
                  <TableHead className="h-auto w-28 px-3 py-2.5 font-semibold text-muted-foreground">
                    Repo call sites
                  </TableHead>
                  <TableHead className="h-auto min-w-[14rem] px-3 py-2.5 font-semibold text-muted-foreground">
                    Repo literals
                  </TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody className="text-foreground">
            {rows.map((r) => {
              const n = showRepo ? (freqs[r.prop] ?? 0) : 0;
              const unusedAtRepo = showRepo && declaredPropsFromScan.includes(r.prop) && n === 0;
              return (
                <TableRow key={r.prop} className="border-border hover:bg-transparent">
                  <TableCell className="px-3 py-2.5 font-mono text-xs">{r.prop}</TableCell>
                  <TableCell className="max-w-[12rem] whitespace-normal px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                    {r.type}
                  </TableCell>
                  <TableCell className="whitespace-normal px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                    {r.default}
                  </TableCell>
                  <TableCell className="whitespace-normal px-3 py-2.5 text-muted-foreground">
                    {r.description}
                  </TableCell>
                  {showRepo ? (
                    <>
                      <TableCell
                        className={`px-3 py-2.5 font-mono text-xs tabular-nums ${unusedAtRepo ? "text-muted-foreground/60" : "text-foreground"}`}
                        title={
                          unusedAtRepo
                            ? "Declared in the scanned component but not passed at any captured call site"
                            : undefined
                        }
                      >
                        ×{n}
                      </TableCell>
                      <TableCell className="whitespace-normal px-3 py-2.5 font-mono text-[11px] leading-snug text-muted-foreground">
                        {formatRepoLiteralChips(valueFreqs[r.prop])}
                      </TableCell>
                    </>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {showRepo && neverPassedDeclared.length > 0 ? (
        <div className="mt-3 rounded-md border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-xs text-amber-950">
          <span className="font-semibold">Declared but never passed in repo: </span>
          <span className="font-mono text-[11px]">{neverPassedDeclared.join(", ")}</span>
        </div>
      ) : null}

      {showRepo && extraRepoProps.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-800">
            Also seen in repo (not in playground)
          </h3>
          <p className="mt-1 text-xs text-gray-600">
            These prop names appear in scanned JSX but are not wired as playground controls on this
            page.
          </p>
          <div className="mt-2 rounded-md border border-border bg-card">
            <Table className="min-w-[28rem] border-collapse text-left">
              <TableHeader>
                <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                  <TableHead className="h-auto px-3 py-2.5 font-semibold text-muted-foreground">
                    Prop
                  </TableHead>
                  <TableHead className="h-auto w-28 px-3 py-2.5 font-semibold text-muted-foreground">
                    Repo call sites
                  </TableHead>
                  <TableHead className="h-auto min-w-[14rem] px-3 py-2.5 font-semibold text-muted-foreground">
                    Repo literals
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extraRepoProps.map((prop) => (
                  <TableRow key={prop} className="border-border hover:bg-transparent">
                    <TableCell className="px-3 py-2.5 font-mono text-xs">{prop}</TableCell>
                    <TableCell className="px-3 py-2.5 font-mono text-xs tabular-nums">
                      ×{freqs[prop] ?? 0}
                    </TableCell>
                    <TableCell className="whitespace-normal px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {formatRepoLiteralChips(valueFreqs[prop])}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
