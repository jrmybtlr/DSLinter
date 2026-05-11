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
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="max-h-112 overflow-auto">
          <table className="min-w-full divide-y divide-neutral-100 text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Severity
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Rule
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Message
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  File
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Line
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 align-top text-neutral-800">
              {filtered.map((f, i) => (
                <tr key={`${f.rule_id}-${f.path}-${f.line ?? "x"}-${i}`}>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${severityStyle[f.severity] ?? severityStyle.info}`}
                    >
                      {f.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-neutral-600">{f.rule_id}</td>
                  <td className="px-3 py-2 text-sm text-neutral-900">{f.message}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-neutral-500">{shortPath(root, f.path)}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-neutral-500">
                    {f.line != null ? f.line : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
