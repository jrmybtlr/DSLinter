import { shortPath } from "./paths";
import type { LintFinding } from "./types";

const severityStyle: Record<string, string> = {
  warning: "text-amber-800 bg-amber-50 border-amber-100",
  error: "text-red-800 bg-red-50 border-red-100",
  info: "text-neutral-700 bg-neutral-50 border-neutral-100",
};

export function FindingsList({ findings, root }: { findings: LintFinding[]; root: string }) {
  const top = [...findings].slice(0, 12);

  if (top.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        No findings — rules are quiet on this snapshot.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
      {top.map((f, i) => (
        <li key={`${f.rule_id}-${i}`} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span
              className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${severityStyle[f.severity] ?? severityStyle.info}`}
            >
              {f.severity}
            </span>
            <p className="mt-1 text-sm text-neutral-900">{f.message}</p>
          </div>
          <p className="shrink-0 font-mono text-[11px] text-neutral-400">
            {shortPath(root, f.path)}
            {f.line != null ? `:${f.line}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
