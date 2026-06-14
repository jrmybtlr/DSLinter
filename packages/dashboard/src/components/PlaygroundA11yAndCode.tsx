import { useCallback } from "react";
import type {
  PlaygroundArgs,
  PlaygroundControl,
  PlaygroundValuesUpdater,
} from "../types/controls";
import type { PlaygroundEntry } from "../types/playground";
import type { A11yModuleSummary } from "../report/a11yForModule";
import type { PlaygroundA11yFinding } from "../playground/scanVariantA11y";
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
  const usage = entry.usageSnippet?.(values) ?? `<${entry.id} />`;

  return (
    <Section id="usage" title="Usage">
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
          <span className="font-mono">dslinter-report.json</span> is available
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
          <span className="font-mono">dslinter-report.json</span> is available
          (same fetch as Governance).
        </EmptyCard>
      )}
    </>
  );
}

type A11yProps = {
  a11y: Omit<A11yModuleSummary, "findings"> & {
    findings: PlaygroundA11yFinding[];
  };
  reportReady: boolean;
  variantScanPending?: boolean;
};

export function PlaygroundA11ySection({
  a11y,
  reportReady,
  variantScanPending = false,
}: A11yProps) {
  const hasFindingRows = reportReady && a11y.findings.length > 0;
  const showVariantColumn = a11y.findings.some(
    (f) => f.variant_label != null && f.variant_label !== "",
  );

  return (
    <>
      {hasFindingRows ? (
        <Table>
          <TableHeader>
            <TableRow>
              {showVariantColumn ? <TableHead>Variant</TableHead> : null}
              <TableHead>Rule</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a11y.findings.map((f, i) => (
              <TableRow
                key={`${f.rule_id}-${f.line ?? "x"}-${f.variant_label ?? ""}-${i}`}
              >
                {showVariantColumn ? (
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {f.variant_label ?? "—"}
                  </TableCell>
                ) : null}
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
          {variantScanPending
            ? "Scanning variant previews for color contrast…"
            : "No accessibility findings on this file or its variant previews in the current report."}
        </EmptyCard>
      ) : (
        <EmptyCard>
          A11y score updates when{" "}
          <span className="font-mono">dslinter-report.json</span> is available
          (same fetch as Governance).
        </EmptyCard>
      )}
    </>
  );
}

type ApiProps = {
  entry: PlaygroundEntry;
  controls: PlaygroundControl[];
  values: PlaygroundArgs;
  onChange: PlaygroundValuesUpdater;
  onReset: () => void;
  /** When set, adds columns for how often each prop appears at scanned JSX call sites. */
  reportUsage?: UsageSummary;
  /** Declared prop names from the scan (definitions + playground specs), used for “never passed” hints. */
  declaredPropsFromScan?: string[];
  /** True when `dslinter-report.json` is loaded (even if this component has no usage row). */
  governanceReportLoaded?: boolean;
};

export function PlaygroundApiReference({
  controls,
  values,
  onChange,
  onReset,
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
  return (
    <Section
      id="api-reference"
      title="API reference"
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {controls.map((c) => {
            const r = rows.find((row) => row.prop === c.key);
            if (!r) return null;
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
                      {r.defaultBadge ? (
                        <Badge variant="secondary" size="sm">
                          {r.defaultBadge}
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
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Section>
  );
}
