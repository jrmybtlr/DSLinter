import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { shortPath } from "./paths";
import type { LintFinding, Severity } from "../types/report";
import { Badge } from "../components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";

type Filter = "all" | Severity;

function isFilter(value: string): value is Filter {
  return (
    value === "all" ||
    value === "error" ||
    value === "warning" ||
    value === "info"
  );
}

export function FindingsList({
  findings,
  root,
}: {
  findings: LintFinding[];
  root: string;
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

  const filtered =
    filter === "all" ? findings : findings.filter((f) => f.severity === filter);

  if (findings.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No findings — rules are quiet on this snapshot.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(value) => {
            if (isFilter(value)) setFilter(value);
          }}
          variant="outline"
          size="sm"
          aria-label="Filter findings by severity"
          className="contents"
        >
          <ToggleGroupItem
            value="all"
            className="rounded-full px-2.5 text-xs font-medium"
          >
            All
            <span className="ml-1 tabular-nums text-muted-foreground">
              {findings.length}
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="warning"
            className="rounded-full px-2.5 text-xs font-medium"
          >
            Warnings
            <span className="ml-1 tabular-nums text-muted-foreground">
              {counts.warning}
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="error"
            className="rounded-full px-2.5 text-xs font-medium"
          >
            Errors
            <span className="ml-1 tabular-nums text-muted-foreground">
              {counts.error}
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="info"
            className="rounded-full px-2.5 text-xs font-medium"
          >
            Info
            <span className="ml-1 tabular-nums text-muted-foreground">
              {counts.info}
            </span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Severity</TableHead>
            <TableHead scope="col">Rule</TableHead>
            <TableHead scope="col">Message</TableHead>
            <TableHead scope="col">File</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="align-top text-foreground">
          {filtered.map((f, i) => (
            <TableRow
              key={`${f.rule_id}-${f.path}-${f.line ?? "x"}-${i}`}
              className="border-border hover:bg-transparent"
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
              <TableCell className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {f.rule_id}
              </TableCell>
              <TableCell className="whitespace-normal px-3 py-2 text-sm">
                {f.message}
              </TableCell>
              <TableCell className="whitespace-normal px-3 py-2 font-mono text-xs text-muted-foreground">
                {shortPath(root, f.path)}:{f.line != null ? f.line : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
