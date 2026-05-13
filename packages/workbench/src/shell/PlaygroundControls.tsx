import { useCallback } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import { Button } from "../components/ui/button";
import { PlaygroundControlField } from "./PlaygroundControlField";

type Props = {
  controls: PlaygroundControl[];
  values: PlaygroundArgs;
  onChange: (next: PlaygroundArgs) => void;
  onReset: () => void;
  /** Omit the outer card wrapper (doc-style pages provide their own section chrome). */
  bare?: boolean;
};

export function PlaygroundControls({
  controls,
  values,
  onChange,
  onReset,
  bare,
}: Props) {
  const patch = useCallback(
    (key: string, value: string | number | boolean) => {
      onChange({ ...values, [key]: value });
    },
    [onChange, values],
  );

  if (controls.length === 0) return null;

  const inner = (
    <>
      <div className="flex p-3 pl-5 flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Controls
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Reset defaults
        </Button>
      </div>
      <div className=" p-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {controls.map((c) => (
          <div key={c.key}>
            <PlaygroundControlField
              control={c}
              values={values}
              patch={patch}
              idPrefix="ctrl"
              layout="grid"
            />
          </div>
        ))}
      </div>
    </>
  );

  if (bare) {
    return <div className="w-full">{inner}</div>;
  }

  return (
    <div className="mx-auto mb-6 max-w-5xl rounded-ds-lg border border-border bg-card p-4 text-card-foreground shadow-xs">
      {inner}
    </div>
  );
}
