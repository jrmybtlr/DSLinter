import { useCallback } from "react";
import type { PlaygroundArgs, PlaygroundControl, PlaygroundValuesUpdater } from "../types/controls";
import type { PlaygroundEntry } from "../types/playground";
import type { A11yModuleSummary } from "../report/a11yForModule";
import type { CodeScoreModuleSummary } from "../report/codeScoreForModule";
import type { LintFinding, UsageSummary } from "../types/report";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { controlsToApiRows } from "./controlApiTable";
import { PlaygroundControlField } from "./PlaygroundControlField";
import { PlaygroundUsageCode } from "./PlaygroundUsageCode";
import { EmptyCard } from "./EmptyCard";
import { cn } from "../lib/utils";
import { Section } from "./Section";

type UsageProps = {
  entry: PlaygroundEntry;
  values: PlaygroundArgs;
};

export function PlaygroundUsageSection({ entry, values }: UsageProps) {
  const usage =
    entry.usageSnippet?.(values) ??
    `// Pass usageSnippet on this PlaygroundEntry, or derive snippets from dslint controls.\n<${entry.id} />`;

  return (
    <Section
      id="usage"
      title="Usage"
      description="Example usage for the current playground values."
    >
      <PlaygroundUsageCode source={usage} />
    </Section>
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
    <>
      {reportReady && findings.length > 0 ? (
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
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {f.rule_id}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {f.line ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" size="sm">
                    {f.severity}
                  </Badge>
                </TableCell>
                <TableCell>{f.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : reportReady && findings.length === 0 ? (
        <EmptyCard>
          No hardcoded or arbitrary token color findings on this file in the
          current report.
        </EmptyCard>
      ) : (
        <EmptyCard>
          Token findings update when{" "}
          <span className="font-mono">dslint-report.json</span> is available
          (same fetch as Governance).
        </EmptyCard>
      )}
    </>
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
    <>
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
        <EmptyCard>
          No quality findings on this file in the current report.
        </EmptyCard>
      ) : (
        <EmptyCard>
          Code score updates when{" "}
          <span className="font-mono">dslint-report.json</span> is available
          (same fetch as Governance).
        </EmptyCard>
      )}
    </>
  );
}

type A11yProps = {
  a11y: A11yModuleSummary;
  reportReady: boolean;
};

export function PlaygroundA11ySection({ a11y, reportReady }: A11yProps) {
  const hasFindingRows = reportReady && a11y.findings.length > 0;

  return (
    <>
      {hasFindingRows ? (
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
            {a11y.findings.map((f, i) => (
              <TableRow key={`${f.rule_id}-${f.line ?? "x"}-${i}`}>
                <TableCell>{f.rule_id}</TableCell>
                <TableCell>{f.line ?? "—"}</TableCell>
                <TableCell>{f.severity}</TableCell>
                <TableCell>{f.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : reportReady && a11y.issueCount === 0 ? (
        <EmptyCard>
          No accessibility findings on this file in the current report.
        </EmptyCard>
      ) : (
        <EmptyCard>
          A11y score updates when{" "}
          <span className="font-mono">dslint-report.json</span> is available
          (same fetch as Governance).
        </EmptyCard>
      )}
    </>
  );
}

type ApiProps = {
  controls: PlaygroundControl[];
  values: PlaygroundArgs;
  onChange: PlaygroundValuesUpdater;
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
      onChange((prev) => ({ ...prev, [key]: value }));
    },
    [onChange],
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
    <Section
      id="api-reference"
      title="API reference"
      description=""
      actions={
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Reset defaults
        </Button>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Prop</TableHead>
            <TableHead>Type</TableHead>
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
                <TableCell className="font-medium">{r.prop}</TableCell>
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
                                "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
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
                    <span className="font-mono text-xs flex items-center gap-1">
                      {r.type}
                      {r.default !== "—" ? (
                        <Badge variant="secondary" size="sm">
                          {r.default}
                        </Badge>
                      ) : null}
                    </span>
                  )}
                </TableCell>
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
          <h3 className="text-sm font-semibold text-foreground">
            Also seen in repo (not in playground)
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
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
    </Section>
  );
}
