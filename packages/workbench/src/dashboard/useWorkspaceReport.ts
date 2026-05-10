import { useEffect, useState } from "react";
import type { WorkspaceReport } from "../types/report";

async function loadReport(url: string): Promise<WorkspaceReport> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<WorkspaceReport>;
}

export type DslintReportState = {
  report: WorkspaceReport | null;
  error: string | null;
  loading: boolean;
};

export function useWorkspaceReport(reportUrl = "/dslint-report.json"): DslintReportState {
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setError(null);
    setReport(null);
    setLoading(true);
    let cancelled = false;
    loadReport(reportUrl)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportUrl]);

  return { report, error, loading };
}
