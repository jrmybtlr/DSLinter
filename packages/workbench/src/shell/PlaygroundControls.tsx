import { useCallback } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";

type Props = {
  controls: PlaygroundControl[];
  values: PlaygroundArgs;
  onChange: (next: PlaygroundArgs) => void;
  onReset: () => void;
  /** Omit the outer card wrapper (doc-style pages provide their own section chrome). */
  bare?: boolean;
};

const labelClass = "text-[11px] font-medium text-slate-600";
const fieldClass =
  "mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-sm outline-none ring-primary focus:border-slate-300 focus:ring-2";

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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Controls</p>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
        >
          Reset defaults
        </button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {controls.map((c) => {
          const id = `ctrl-${c.key}`;
          switch (c.type) {
            case "boolean": {
              const checked = Boolean(values[c.key]);
              return (
                <div key={c.key} className="flex flex-col">
                  <label htmlFor={id} className={`${labelClass} flex items-center gap-2`}>
                    <input
                      id={id}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => patch(c.key, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    {c.label}
                  </label>
                  {c.hint ? <p className="mt-1 text-[10px] text-slate-400">{c.hint}</p> : null}
                </div>
              );
            }
            case "string":
              return (
                <div key={c.key} className="flex min-w-0 flex-col">
                  <label htmlFor={id} className={labelClass}>
                    {c.label}
                  </label>
                  <input
                    id={id}
                    type="text"
                    value={String(values[c.key] ?? "")}
                    placeholder={c.placeholder}
                    onChange={(e) => patch(c.key, e.target.value)}
                    className={fieldClass}
                  />
                </div>
              );
            case "number": {
              const raw = values[c.key];
              const parsed =
                typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);
              const safe = Number.isFinite(parsed) ? parsed : c.default;
              return (
                <div key={c.key} className="flex min-w-0 flex-col">
                  <label htmlFor={id} className={labelClass}>
                    {c.label}
                  </label>
                  <input
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
                    className={fieldClass}
                  />
                </div>
              );
            }
            case "select":
              return (
                <div key={c.key} className="flex min-w-0 flex-col">
                  <label htmlFor={id} className={labelClass}>
                    {c.label}
                  </label>
                  <select
                    id={id}
                    value={String(values[c.key] ?? c.default ?? "")}
                    onChange={(e) => patch(c.key, e.target.value)}
                    className={fieldClass}
                  >
                    {c.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
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
    <div className="mx-auto mb-6 max-w-5xl rounded-ds-lg border border-slate-200 bg-white p-4 shadow-sm">{inner}</div>
  );
}
