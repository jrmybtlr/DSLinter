import { useCallback } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

type Props = {
  controls: PlaygroundControl[];
  values: PlaygroundArgs;
  onChange: (next: PlaygroundArgs) => void;
  onReset: () => void;
  /** Omit the outer card wrapper (doc-style pages provide their own section chrome). */
  bare?: boolean;
};

const labelClass = "text-[11px] font-medium text-muted-foreground";

export function PlaygroundControls({ controls, values, onChange, onReset, bare }: Props) {
  const patch = useCallback(
    (key: string, value: string | number | boolean) => {
      onChange({ ...values, [key]: value });
    },
    [onChange, values],
  );

  if (controls.length === 0) return null;

  const inner = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Controls</p>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Reset defaults
        </Button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {controls.map((c) => {
          const id = `ctrl-${c.key}`;
          switch (c.type) {
            case "boolean": {
              const checked = Boolean(values[c.key]);
              return (
                <div key={c.key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(v: boolean | "indeterminate") => patch(c.key, v === true)}
                    />
                    <Label htmlFor={id} className={`${labelClass} cursor-pointer font-normal`}>
                      {c.label}
                    </Label>
                  </div>
                  {c.hint ? <p className="text-[10px] text-muted-foreground">{c.hint}</p> : null}
                </div>
              );
            }
            case "string":
              return (
                <div key={c.key} className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={id} className={labelClass}>
                    {c.label}
                  </Label>
                  <Input
                    id={id}
                    type="text"
                    value={String(values[c.key] ?? "")}
                    placeholder={c.placeholder}
                    onChange={(e) => patch(c.key, e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              );
            case "number": {
              const raw = values[c.key];
              const parsed =
                typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
              const safe = Number.isFinite(parsed) ? parsed : c.default;
              return (
                <div key={c.key} className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={id} className={labelClass}>
                    {c.label}
                  </Label>
                  <Input
                    id={id}
                    type="number"
                    value={safe}
                    min={c.min}
                    max={c.max}
                    step={c.step ?? 1}
                    onChange={(e) => {
                      const v = e.target.valueAsNumber;
                      patch(c.key, Number.isFinite(v) ? v : c.default);
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              );
            }
            case "select": {
              const v = String(values[c.key] ?? c.default ?? "");
              return (
                <div key={c.key} className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={id} className={labelClass}>
                    {c.label}
                  </Label>
                  <Select value={v} onValueChange={(next: string) => patch(c.key, next)}>
                    <SelectTrigger id={id} className="h-8 text-xs">
                      <SelectValue placeholder={c.label} />
                    </SelectTrigger>
                    <SelectContent>
                      {c.options.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            default:
              return null;
          }
        })}
      </div>
    </>
  );

  if (bare) {
    return <div className="w-full">{inner}</div>;
  }

  return (
    <div className="mx-auto mb-6 max-w-5xl rounded-ds-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
      {inner}
    </div>
  );
}
