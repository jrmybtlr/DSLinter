import { useCallback } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type { PlaygroundEntry } from "../types/playground";
import type { A11yModuleSummary } from "../report/a11yForModule";
import type { CodeScoreModuleSummary } from "../report/codeScoreForModule";
import type { LintFinding, UsageSummary } from "../types/report";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { controlsToApiRows } from "./controlApiTable";
import { PlaygroundControlField } from "./PlaygroundControlField";
import { PlaygroundUsageCode } from "./PlaygroundUsageCode";
import { EmptyCard } from "./EmptyCard";
import { cn } from "../lib/utils";

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

export function PlaygroundTokenStyleSection({
  findings,
  reportReady,
}: TokenStyleProps) {
  return (
    <section id="design-tokens" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>Design tokens and colors</h2>
      {reportReady && findings.length > 0 ? (
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Rule</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map((f, i) => (
              <TableRow key={`${f.rule_id}-${f.line ?? "x"}-${i}`}>
                <TableCell>{f.rule_id}</TableCell>
                <TableCell>{f.line ?? "—"}</TableCell>
                <TableCell>{f.severity}</TableCell>
                <TableCell>{f.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : reportReady && findings.length === 0 ? (
        <EmptyCard className="mt-2">
          No hardcoded or arbitrary token color findings on this file in the
          current report.
        </EmptyCard>
      ) : (
        <EmptyCard className="mt-2">
          Token findings update when{" "}
          <span className="font-mono">dslint-report.json</span> is available
          (same fetch as Governance).
        </EmptyCard>
      )}
    </section>
  );
}

type CodeScoreProps = {
  codeScore: CodeScoreModuleSummary;
  reportReady: boolean;
};

export function PlaygroundCodeScoreSection({
  codeScore,
  reportReady,
}: CodeScoreProps) {
  const { findings } = codeScore;

  const hasFindingRows = reportReady && findings.length > 0;

  return (
    <section id="code-score" className="scroll-mt-20">
      <h2 className={sectionTitleClass}>
        Code score: {reportReady ? codeScore.score : "—"}/100
      </h2>

      {hasFindingRows ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Line</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((f, i) => (
                <TableRow key={`${f.rule_id}-${f.line ?? "x"}-${i}`}>
                  <TableCell>{f.rule_id}</TableCell>
                  <TableCell>{f.line ?? "—"}</TableCell>
                  <TableCell>{f.severity}</TableCell>
                  <TableCell>{f.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : reportReady && findings.length === 0 ? (
        <EmptyCard className="mt-2">
          No quality findings on this file in the current report.
        </EmptyCard>
      ) : (
        <EmptyCard className="mt-2">
          Code score updates when{" "}
          <span className="font-mono">dslint-report.json</span> is available
          (same fetch as Governance).
        </EmptyCard>
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
      <h2 className={sectionTitleClass}>
        Accessibility: {reportReady ? a11y.score : "—"}/100
      </h2>
      {hasFindingRows ? (
        <>
          <ul className="mt-3 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 text-xs">
            {a11y.findings.map((f, i) => (
              <li
                key={`${f.rule_id}-${i}`}
                className="flex flex-col gap-0.5 px-2 py-2 sm:flex-row sm:justify-between"
              >
                <span className="font-mono text-xs text-gray-600">
                  {f.rule_id}
                </span>
                <span className="text-gray-800">{f.message}</span>
                {f.line != null ? (
                  <span className="shrink-0 font-mono text-xs text-gray-400">
                    :{f.line}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : reportReady && a11y.issueCount === 0 ? (
        <EmptyCard className="mt-2">
          No accessibility findings on this file in the current report.
        </EmptyCard>
      ) : (
        <EmptyCard className="mt-2">
          A11y score updates when{" "}
          <span className="font-mono">dslint-report.json</span> is available
          (same fetch as Governance).
        </EmptyCard>
      )}
    </section>
  );
}

type ApiProps = {
  controls: PlaygroundControl[];
  values: PlaygroundArgs;
  onChange: (next: PlaygroundArgs) => void;
  onReset: () => void;
  /** When set, adds columns for how often each prop appears at scanned JSX call sites. */
  reportUsage?: UsageSummary;
  /** Declared prop names from the scan (definitions + playground specs), used for “never passed” hints. */
  declaredPropsFromScan?: string[];
  /** True when `dslint-report.json` is loaded (even if this component has no usage row). */
  governanceReportLoaded?: boolean;
};

function formatRepoLiteralChips(
  byVal: Record<string, number> | undefined,
  max = 6,
): string {
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
  values,
  onChange,
  onReset,
  reportUsage,
  declaredPropsFromScan: _declaredPropsFromScan = [],
  governanceReportLoaded: _governanceReportLoaded = false,
}: ApiProps) {
  if (controls.length === 0) return null;

  const patch = useCallback(
    (key: string, value: string | number | boolean) => {
      onChange({ ...values, [key]: value });
    },
    [onChange, values],
  );

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

  return (
    <section id="api-reference" className="scroll-mt-20 grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className={sectionTitleClass}>API reference</h2>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Reset defaults
        </Button>
      </div>
      <Table className="border-collapse text-left">
        <TableHeader>
          <TableRow>
            <TableHead>Prop</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Default</TableHead>
            <TableHead>Value</TableHead>
            {showRepo ? (
              <>
                <TableHead>Usage</TableHead>
                <TableHead>Values</TableHead>
              </>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {controls.map((c) => {
            const r = rows.find((row) => row.prop === c.key);
            if (!r) return null;
            const n = showRepo ? (freqs[r.prop] ?? 0) : 0;
            const valueChips = formatRepoLiteralChips(valueFreqs[r.prop]);
            return (
              <TableRow key={r.prop}>
                <TableCell>{r.prop}</TableCell>
                <TableCell>
                  {c.type === "select" ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {c.options.map((o) => {
                        const current = String(
                          values[c.key] ?? c.default ?? "",
                        );
                        const selected = current === o.value;
                        return (
                          <Badge
                            key={o.value}
                            variant="outline"
                            size="sm"
                            asChild
                            className={cn(
                              selected &&
                                "border-transparent bg-neutral-900 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300",
                            )}
                          >
                            <button
                              type="button"
                              className="cursor-pointer"
                              onClick={() => patch(c.key, o.value)}
                              aria-pressed={selected}
                              aria-label={`Set ${c.label} to ${o.label}`}
                            >
                              {o.value}
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="font-mono">{r.type}</span>
                  )}
                </TableCell>
                <TableCell>{r.default}</TableCell>
                <TableCell>
                  <PlaygroundControlField
                    control={c}
                    values={values}
                    patch={patch}
                    idPrefix="api"
                    layout="table"
                  />
                </TableCell>
                {showRepo ? (
                  <>
                    <TableCell>{n}</TableCell>
                    <TableCell>{valueChips}</TableCell>
                  </>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {showRepo && extraRepoProps.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-800">
            Also seen in repo (not in playground)
          </h3>
          <p className="mt-1 text-xs text-gray-600">
            These prop names appear in scanned JSX but are not wired as
            playground controls on this page.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prop</TableHead>
                <TableHead>Repo call sites</TableHead>
                <TableHead>Repo literals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extraRepoProps.map((prop) => (
                <TableRow key={prop}>
                  <TableCell>{prop}</TableCell>
                  <TableCell>×{freqs[prop] ?? 0}</TableCell>
                  <TableCell>
                    {formatRepoLiteralChips(valueFreqs[prop])}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </section>
  );
}
