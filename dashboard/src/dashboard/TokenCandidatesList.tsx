import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { EmptyCard } from "../components/EmptyCard";
import type { TokenCandidate, TokenCandidateSummary } from "../types/report";
import { SourceLocationLink } from "./SourceLocationLink";
import { pluralize } from "usemods";

const groups: { key: keyof TokenCandidateSummary; title: string }[] = [
  { key: "colors", title: "Hardcoded colors" },
  { key: "arbitrary_classes", title: "Arbitrary Tailwind classes" },
  { key: "inline_styles", title: "Inline styles" },
];

function swatchColor(candidate: TokenCandidate): string | undefined {
  if (candidate.category !== "color") return undefined;
  const match = candidate.value.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/);
  return match?.[0];
}

function Recommendation({ candidate }: { candidate: TokenCandidate }) {
  if (candidate.use_instead) {
    return (
      <span className="text-xs text-muted-foreground">
        Use <code className="font-mono text-foreground">{candidate.use_instead}</code>
      </span>
    );
  }
  if (candidate.suggested_token) {
    return (
      <span className="text-xs text-muted-foreground">
        New token <code className="font-mono text-foreground">{candidate.suggested_token}</code>
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

function CandidateTable({ rows, root }: { rows: TokenCandidate[]; root: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Value</TableHead>
          <TableHead scope="col" className="text-right">
            Uses
          </TableHead>
          <TableHead scope="col">Recommendation</TableHead>
          <TableHead scope="col">First seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => {
          const swatch = swatchColor(c);
          const first = c.locations[0];
          return (
            <TableRow key={c.value}>
              <TableCell className="font-mono text-xs">
                <span className="inline-flex items-center gap-2">
                  {swatch ? (
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-sm border border-border"
                      style={{ backgroundColor: swatch }}
                    />
                  ) : null}
                  {c.value}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {c.reference_count}
                <span className="ml-1 text-xs text-muted-foreground">
                  · {c.file_count} {pluralize("file", c.file_count)}
                </span>
              </TableCell>
              <TableCell>
                <Recommendation candidate={c} />
              </TableCell>
              <TableCell className="max-w-64 min-w-0">
                {first ? (
                  <SourceLocationLink root={root} path={first.path} line={first.line} />
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function TokenCandidatesList({
  candidates,
  root,
}: {
  candidates?: TokenCandidateSummary;
  root: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = groups
    .map((g) => ({
      ...g,
      rows: (candidates?.[g.key] ?? []).filter((c) => showAll || c.recommended),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Include values used only once
      </label>
      {visible.length === 0 ? (
        <EmptyCard>No repeated hardcoded values — nothing to promote to a token.</EmptyCard>
      ) : (
        visible.map((g) => (
          <div key={g.key}>
            <h3 className="mb-2 text-sm font-semibold text-foreground">
              {g.title} · {g.rows.length}
            </h3>
            <CandidateTable rows={g.rows} root={root} />
          </div>
        ))
      )}
    </div>
  );
}
