import { useMemo, useState } from "react";
import { shortPath } from "./paths";
import type { LintFinding, Severity } from "../types/report";

const severityStyle: Record<string, string> = {
  warning: "text-amber-800 bg-amber-50 border-amber-100",
  error: "text-red-800 bg-red-50 border-red-100",
  info: "text-neutral-700 bg-neutral-50 border-neutral-100",
};

type Filter = "all" | Severity;

export function FindingsList({ findings, root }: { findings: LintFinding[]; root: string }) {
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

  const filtered = filter === "all" ? findings : findings.filter((f) => f.severity === filter);

  if (findings.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        No findings — rules are quiet on this snapshot.
      </p>
    );
  }

  const chip = (label: string, value: Filter, count: number) => (
    <button
      key={label}
      type="button"
      onClick={() => setFilter(value)}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
        filter === value
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
      }`}
    >
      {label}
      <span className="ml-1 tabular-nums text-neutral-400">{count}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chip("All", "all", findings.length)}
        {chip("Warnings", "warning", counts.warning)}
        {chip("Errors", "error", counts.error)}
        {chip("Info", "info", counts.info)}
      </div>
      <ul className="max-h-[28rem] divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200 bg-white">
        {filtered.map((f, i) => (
          <li
            key={`${f.rule_id}-${f.path}-${f.line ?? "x"}-${i}`}
            className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <span
                className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${severityStyle[f.severity] ?? severityStyle.info}`}
              >
                {f.severity}
              </span>
              <p className="mt-1 font-mono text-[11px] text-neutral-500">{f.rule_id}</p>
              <p className="mt-1 text-sm text-neutral-900">{f.message}</p>
            </div>
            <p className="shrink-0 font-mono text-[11px] text-neutral-400">
              {shortPath(root, f.path)}
              {f.line != null ? `:${f.line}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
