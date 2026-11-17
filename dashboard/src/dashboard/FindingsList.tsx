import { type ReactNode, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import type { LintFinding, Severity } from "../types/report";
import { Badge } from "../components/ui/badge";
import { EmptyCard } from "../components/EmptyCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { SourceLocationLink } from "./SourceLocationLink";

type Filter = "all" | Severity;

function isFilter(value: string): value is Filter {
  return value === "all" || value === "error" || value === "warning" || value === "info";
}

function emptyFilterMessage(filter: Exclude<Filter, "all">): string {
  if (filter === "error") return "No errors in these findings.";
  if (filter === "warning") return "No warnings in these findings.";
  return "No info findings in these findings.";
}

export function FindingsList({
  findings,
  root,
  heading,
  children,
}: {
  findings: LintFinding[];
  root: string;
  heading?: { id: string; title: string; description: string };
  children?: ReactNode;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 };
    for (const f of findings) {
      if (f.severity === "error") c.error += 1;
      else if (f.severity === "warning") c.warning += 1;
      else c.info += 1;
    }
    return c;
  }, [findings]);

  const filtered = useMemo(
    () => (filter === "all" ? findings : findings.filter((f) => f.severity === filter)),
    [findings, filter],
  );

  return (
    <div className="@container">
      <div className="flex flex-col items-start gap-4 @4xl:flex-row @4xl:items-center @4xl:justify-between">
        {heading ? (
          <div className="min-w-0">
            <h2 id={heading.id} className="text-lg font-semibold text-balance text-foreground">
              {heading.title}
            </h2>
            <p className="mt-1 text-base text-pretty text-muted-foreground sm:text-sm">
              {heading.description}
            </p>
          </div>
        ) : null}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
          <Select
            value={filter}
            onValueChange={(value) => {
              if (isFilter(value)) setFilter(value);
            }}
            name="severity"
            disabled={findings.length === 0}
          >
            <SelectTrigger
              aria-label="Filter findings by severity"
              className="w-auto min-w-44 shrink-0 gap-3 bg-card text-base shadow-none sm:text-sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All severities · {findings.length}</SelectItem>
              <SelectItem value="warning">Warnings · {counts.warning}</SelectItem>
              <SelectItem value="error">Errors · {counts.error}</SelectItem>
              <SelectItem value="info">Info · {counts.info}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyCard className="mt-4">
          {filter === "all" ? "No findings" : emptyFilterMessage(filter)}
        </EmptyCard>
      ) : (
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Severity</TableHead>
              <TableHead scope="col">Rule</TableHead>
              <TableHead scope="col">File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="align-top text-foreground">
            {filtered.map((f, i) => (
              <TableRow
                key={`${f.rule_id}-${f.path}-${f.line ?? "x"}-${i}`}
                className="border-border"
                className:hover="bg-transparent"
              >
                <TableCell className="px-3 py-2">
                  <Badge
                    variant={
                      f.severity === "error"
                        ? "destructive"
                        : f.severity === "warning"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {f.severity}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-0 px-3 py-2 whitespace-normal">
                  <div className="font-mono text-xs text-muted-foreground">{f.rule_id}</div>
                  <div className="mt-0.5 text-xs text-pretty text-foreground">{f.message}</div>
                </TableCell>
                <TableCell className="min-w-0 px-3 py-2">
                  <SourceLocationLink root={root} path={f.path} line={f.line} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
