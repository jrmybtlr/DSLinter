import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PlaygroundArgs } from "../types/controls";
import { scanVariantPreviews, type PlaygroundA11yFinding } from "../playground/scanVariantA11y";
import { Badge } from "./ui/badge";
import { PLAYGROUND_VARIANT_MATRIX_CAP } from "../playground/enumerateControlCombinations";

type Props = {
  renderPreview: (values: PlaygroundArgs) => ReactNode;
  combinations: PlaygroundArgs[];
  finiteAxisKeys: string[];
  totalCount: number;
  capped: boolean;
  onVariantA11yScan?: (findings: PlaygroundA11yFinding[]) => void;
  pageSize?: number;
};

function formatValue(value: string | number | boolean): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function variantKey(combo: PlaygroundArgs, axisKeys: string[]): string {
  return axisKeys.map((k) => `${k}:${formatValue(combo[k] ?? "")}`).join("|");
}

export function PlaygroundVariantMatrix({
  renderPreview,
  combinations,
  finiteAxisKeys,
  totalCount,
  capped,
  onVariantA11yScan,
  pageSize,
}: Props) {
  const [page, setPage] = useState(0);
  const previewRefs = useRef(new Map<string, HTMLDivElement>());

  const allCombinations = combinations.filter((combo) => combo.asChild !== true);
  const pages = pageSize ? Math.max(1, Math.ceil(allCombinations.length / pageSize)) : 1;
  const currentPage = Math.min(page, pages - 1);
  const visibleCombinations = pageSize
    ? allCombinations.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : allCombinations;
  const visibleAxisKeys = finiteAxisKeys.filter((key) => key !== "asChild");
  const skipsAsChildAxis = finiteAxisKeys.includes("asChild");
  const adjustedTotalCount = skipsAsChildAxis ? Math.ceil(totalCount / 2) : totalCount;

  useEffect(() => {
    if (!onVariantA11yScan || visibleCombinations.length === 0) return;

    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      void (async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
        if (cancelled) return;

        const targets = visibleCombinations.flatMap((combo) => {
          const key = variantKey(combo, visibleAxisKeys);
          const element = previewRefs.current.get(key);
          if (!element) return [];
          return [{ element, combo, axisKeys: visibleAxisKeys }];
        });

        if (targets.length === 0) {
          if (!cancelled) onVariantA11yScan([]);
          return;
        }

        try {
          const findings = await scanVariantPreviews(targets);
          if (!cancelled) onVariantA11yScan(findings);
        } catch {
          if (!cancelled) onVariantA11yScan([]);
        }
      })();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [onVariantA11yScan, visibleCombinations, visibleAxisKeys]);

  if (visibleCombinations.length === 0) return null;

  return (
    <>
      {pageSize && pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button
            type="button"
            className="rounded border border-border px-3 py-1 disabled:opacity-40"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous variants
          </button>
          <span className="text-muted-foreground">
            Page {currentPage + 1} of {pages}
          </span>
          <button
            type="button"
            className="rounded border border-border px-3 py-1 disabled:opacity-40"
            disabled={currentPage + 1 >= pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next variants
          </button>
        </div>
      )}
      {capped ? (
        <p className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
          Showing {allCombinations.length} of {adjustedTotalCount} combinations (limit{" "}
          {PLAYGROUND_VARIANT_MATRIX_CAP}). Reduce select options or split controls to preview more
          here.
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-4">
        {visibleCombinations.map((combo) => {
          const key = variantKey(combo, visibleAxisKeys);
          return (
            <div
              key={key}
              className="flex min-w-0 flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-xs"
            >
              <div className="flex flex-wrap gap-1 border-b p-2">
                {visibleAxisKeys.map((k) => {
                  const v = combo[k];
                  return (
                    <Badge key={k} variant="outline" size="sm" className="font-mono text-xs">
                      {k}={v === undefined ? "?" : formatValue(v)}
                    </Badge>
                  );
                })}
              </div>
              <div
                ref={(el) => {
                  if (el) previewRefs.current.set(key, el);
                  else previewRefs.current.delete(key);
                }}
                className="min-w-0 p-3"
              >
                {renderPreview(combo)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
