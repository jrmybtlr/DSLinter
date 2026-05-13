import type { PlaygroundArgs } from "../types/controls";
import type { PlaygroundPreviewComponent } from "../types/preview";
import { Badge } from "../components/ui/badge";
import { PLAYGROUND_VARIANT_MATRIX_CAP } from "../playground/enumerateControlCombinations";

type Props = {
  Preview: PlaygroundPreviewComponent;
  combinations: PlaygroundArgs[];
  finiteAxisKeys: string[];
  totalCount: number;
  capped: boolean;
};

function formatValue(value: string | number | boolean): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function PlaygroundVariantMatrix({
  Preview,
  combinations,
  finiteAxisKeys,
  totalCount,
  capped,
}: Props) {
  if (combinations.length === 0) return null;

  return (
    <>
      {capped ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Showing {combinations.length} of {totalCount} combinations (limit {PLAYGROUND_VARIANT_MATRIX_CAP}).
          Reduce select options or split controls to preview more here.
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-4">
          {combinations.map((combo) => (
            <div
              key={finiteAxisKeys.map((k) => `${k}:${formatValue(combo[k] ?? "")}`).join("|")}
              className="flex min-w-0 flex-col overflow-hidden rounded-lg border  bg-white shadow-xs"
            >
              <div className="flex flex-wrap gap-1 border-b p-2">
                {finiteAxisKeys.map((k) => {
                  const v = combo[k];
                  return (
                    <Badge key={k} variant="outline" size="sm" className="font-mono text-xs">
                      {k}={v === undefined ? "?" : formatValue(v)}
                    </Badge>
                  );
                })}
              </div>
              <div className="min-w-0 bg-white p-3">
                <Preview values={combo} />
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
