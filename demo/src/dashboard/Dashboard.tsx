import { useEffect, useState } from "react";
import { ComponentCatalog } from "./ComponentCatalog";
import { FindingsList } from "./FindingsList";
import { ScoreStrip } from "./ScoreStrip";
import { TokenWall } from "./TokenWall";
import type { WorkspaceReport } from "./types";

async function loadReport(): Promise<WorkspaceReport> {
  const res = await fetch("/dslint-report.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<WorkspaceReport>;
}

export function Dashboard() {
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadReport()
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load report");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm font-medium text-neutral-900">Could not load DSLint report</p>
        <p className="mt-2 text-xs text-neutral-500">{error}</p>
        <p className="mt-6 text-xs text-neutral-500">
          Run from repo root:{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-700">
            npm run dslint:report
          </code>{" "}
          inside <span className="font-mono">demo/</span>, then refresh.
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500">
        Loading inventory…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Inventory</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-neutral-900">Components & tokens</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Generated from DSLint scan data — Storybook-style overview without maintaining separate story
            files. Token wall mirrors this demo&apos;s Tailwind theme.
          </p>
          <p className="mt-3 font-mono text-[11px] text-neutral-400">
            Root: {report.root}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-8">
        <ScoreStrip scores={report.scores} />

        {report.duplicate_components.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
            <span className="font-semibold">Duplicate component names: </span>
            {report.duplicate_components.map((d) => d.name).join(", ")}
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Components</h2>
              <p className="text-xs text-neutral-500">Definitions and JSX usage from the latest snapshot.</p>
            </div>
            <span className="text-xs text-neutral-400">
              {report.files.length} files scanned
            </span>
          </div>
          <ComponentCatalog report={report} />
        </section>

        <section className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900">Design tokens</h2>
            <TokenWall />
          </div>
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Governance signals</h2>
                <p className="text-xs text-neutral-500">
                  Accessibility (`a11y-*`) and code smell (`smell-*`) rules from the latest DSLint run.
                </p>
              </div>
              <span className="text-xs text-neutral-400">{report.findings.length} total</span>
            </div>
            <FindingsList findings={report.findings} root={report.root} />
          </div>
        </section>
      </main>
    </div>
  );
}
