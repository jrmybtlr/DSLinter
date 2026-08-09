import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const labelClass = "text-xs font-medium text-muted-foreground";
/** Match Input defaults (h-9, text-sm at md+) so selects don't render smaller. */
const controlFieldClass = "h-9 text-sm";
const controlFieldWideClass = `${controlFieldClass} max-w-xs min-w-40`;

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
                onCheckedChange={(v: boolean | "indeterminate") => patch(c.key, v === true)}
              />
              <Label htmlFor={id} className={`${labelClass} cursor-pointer font-normal`}>
                {c.label}
              </Label>
            </div>
            {c.hint ? <p className="text-xs text-muted-foreground">{c.hint}</p> : null}
          </div>
        );
      }
      case "string":
      case "stringArray":
      case "numberArray":
      case "node":
        if (
          (c.type === "string" || c.type === "stringArray" || c.type === "numberArray") &&
          c.hint
        ) {
          return (
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor={id} className={labelClass}>
                {c.label}
              </Label>
              <textarea
                id={id}
                value={String(values[c.key] ?? "")}
                placeholder={c.placeholder}
                onChange={(e) => patch(c.key, e.target.value)}
                rows={3}
                className="min-h-18 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-xs outline-none"
                className:focus-visible="border-ring ring-[3px] ring-ring/50"
              />
              <p className="text-xs text-muted-foreground">{c.hint}</p>
            </div>
          );
        }
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
              className={controlFieldClass}
            />
          </div>
        );
      case "icon":
      case "object":
      case "function":
        return (
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label className={labelClass}>{c.label}</Label>
            <p className="text-xs text-muted-foreground">Not editable</p>
          </div>
        );
      case "number": {
        const raw = values[c.key];
        const parsed = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
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
              className={controlFieldClass}
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
            <Select value={v} onValueChange={(next: string) => patch(c.key, next)}>
              <SelectTrigger id={id} className={controlFieldClass}>
                <SelectValue placeholder={c.label} />
              </SelectTrigger>
              <SelectContent>
                {c.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
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
        <div className="flex min-w-32 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={checked}
              aria-label={c.label}
              onCheckedChange={(v: boolean | "indeterminate") => patch(c.key, v === true)}
            />
            <span className="text-xs text-muted-foreground">{c.label}</span>
          </div>
          {c.hint ? <p className="text-xs text-muted-foreground">{c.hint}</p> : null}
        </div>
      );
    }
    case "string":
    case "stringArray":
    case "numberArray":
    case "node":
      return (
        <Input
          id={id}
          type="text"
          value={String(values[c.key] ?? "")}
          placeholder={c.placeholder}
          onChange={(e) => patch(c.key, e.target.value)}
          className={controlFieldWideClass}
          aria-label={c.label}
        />
      );
    case "icon":
    case "object":
    case "function":
      return (
        <span className="text-xs text-muted-foreground" aria-label={c.label}>
          —
        </span>
      );
    case "number": {
      const raw = values[c.key];
      const parsed = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
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
          className={`${controlFieldClass} w-24`}
          aria-label={c.label}
        />
      );
    }
    case "select": {
      const v = String(values[c.key] ?? c.default ?? "");
      return (
        <Select value={v} onValueChange={(next: string) => patch(c.key, next)}>
          <SelectTrigger id={id} className={controlFieldWideClass} aria-label={c.label}>
            <SelectValue placeholder={c.label} />
          </SelectTrigger>
          <SelectContent>
            {c.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
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
