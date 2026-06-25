import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const labelClass = "text-xs font-medium text-muted-foreground";

export type PlaygroundControlFieldProps = {
  control: PlaygroundControl;
  values: PlaygroundArgs;
  patch: (key: string, value: string | number | boolean) => void;
  /** Prefix for element ids (e.g. `ctrl` vs `api`). */
  idPrefix: string;
  layout: "grid" | "table";
};

export function PlaygroundControlField({
  control: c,
  values,
  patch,
  idPrefix,
  layout,
}: PlaygroundControlFieldProps) {
  const id = `${idPrefix}-${c.key}`;

  if (layout === "grid") {
    switch (c.type) {
      case "boolean": {
        const checked = Boolean(values[c.key]);
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(v: boolean | "indeterminate") =>
                  patch(c.key, v === true)
                }
              />
              <Label
                htmlFor={id}
                className={`${labelClass} cursor-pointer font-normal`}
              >
                {c.label}
              </Label>
            </div>
            {c.hint ? (
              <p className="text-xs text-muted-foreground">{c.hint}</p>
            ) : null}
          </div>
        );
      }
      case "string":
      case "node":
        return (
          <div className="flex min-w-0 flex-col gap-1.5">
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
          <div className="flex min-w-0 flex-col gap-1.5">
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
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={id} className={labelClass}>
              {c.label}
            </Label>
            <Select
              value={v}
              onValueChange={(next: string) => patch(c.key, next)}
            >
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
  }

  // table: prop name is in its own column; compact editors only
  switch (c.type) {
    case "boolean": {
      const checked = Boolean(values[c.key]);
      return (
        <div className="flex min-w-[8rem] flex-col gap-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={checked}
              aria-label={c.label}
              onCheckedChange={(v: boolean | "indeterminate") =>
                patch(c.key, v === true)
              }
            />
            <span className="text-xs text-muted-foreground">{c.label}</span>
          </div>
          {c.hint ? (
            <p className="text-xs text-muted-foreground">{c.hint}</p>
          ) : null}
        </div>
      );
    }
    case "string":
    case "node":
      return (
        <Input
          id={id}
          type="text"
          value={String(values[c.key] ?? "")}
          placeholder={c.placeholder}
          onChange={(e) => patch(c.key, e.target.value)}
          className="h-8 min-w-[10rem] max-w-xs text-xs"
          aria-label={c.label}
        />
      );
    case "number": {
      const raw = values[c.key];
      const parsed =
        typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
      const safe = Number.isFinite(parsed) ? parsed : c.default;
      return (
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
          className="h-8 w-24 text-xs"
          aria-label={c.label}
        />
      );
    }
    case "select": {
      const v = String(values[c.key] ?? c.default ?? "");
      return (
        <Select value={v} onValueChange={(next: string) => patch(c.key, next)}>
          <SelectTrigger
            id={id}
            className="h-8 min-w-[10rem] max-w-xs text-xs"
            aria-label={c.label}
          >
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
      );
    }
    default:
      return null;
  }
}
