import { useEffect, useRef, useState } from "react";
import type { WorkspaceReport } from "../types/report";

async function loadReport(url: string): Promise<WorkspaceReport> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<WorkspaceReport>;
}

export type DslinterReportState = {
  report: WorkspaceReport | null;
  error: string | null;
  loading: boolean;
};

export type UseWorkspaceReportOptions = {
  /** URL of the JSON report file. */
  reportUrl?: string;
  /**
   * URL of the SSE endpoint (e.g. `http://localhost:7878/events`) emitted by
   * `dslint --serve`.  When provided the hook subscribes and re-fetches the
   * report on every `data: updated` event.
   */
  watchUrl?: string;
  /**
   * Polling interval in milliseconds (0 = off).  Used as a fallback when
   * `watchUrl` is not provided.  On each tick the hook issues a `HEAD` request
   * and re-fetches the full JSON only when `Last-Modified` / `ETag` changed.
   */
  refreshIntervalMs?: number;
};

export function useWorkspaceReport(
  reportUrlOrOptions: string | UseWorkspaceReportOptions = "/dslinter-report.json",
): DslinterReportState {
  // Accept either the legacy string overload or the options object.
  const {
    reportUrl = "/dslinter-report.json",
    watchUrl,
    refreshIntervalMs = 0,
  }: UseWorkspaceReportOptions = typeof reportUrlOrOptions === "string"
    ? { reportUrl: reportUrlOrOptions }
    : reportUrlOrOptions;

  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref tracking the last known ETag / Last-Modified for poll-based change detection.
  const etagRef = useRef<string | null>(null);

  // Core fetch function.
  const fetchReport = (
    url: string,
    cancelled: { value: boolean },
    options?: { showLoading?: boolean },
  ) => {
    const showLoading = options?.showLoading !== false;
    if (showLoading) {
      setError(null);
      setLoading(true);
    }
    loadReport(url)
      .then((r) => {
        if (!cancelled.value) setReport(r);
      })
      .catch((e: unknown) => {
        if (!cancelled.value) setError(e instanceof Error ? e.message : "Failed to load report");
      })
      .finally(() => {
        if (!cancelled.value && showLoading) setLoading(false);
      });
  };

  // Initial load.
  useEffect(() => {
    const cancelled = { value: false };
    fetchReport(reportUrl, cancelled, { showLoading: true });
    return () => {
      cancelled.value = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportUrl]);

  // SSE subscription (takes priority over polling).
  useEffect(() => {
    if (!watchUrl) return;
    const source = new EventSource(watchUrl);
    const cancelled = { value: false };

    source.onmessage = (e) => {
      if (cancelled.value) return;
      if (e.data === "updated") {
        fetchReport(reportUrl, cancelled, { showLoading: false });
      }
    };

    source.onerror = () => {
      // SSE errors are transient; the browser will reconnect automatically.
    };

    return () => {
      cancelled.value = true;
      source.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchUrl, reportUrl]);

  // Polling fallback (only when watchUrl is absent and refreshIntervalMs > 0).
  useEffect(() => {
    if (watchUrl || refreshIntervalMs <= 0) return;

    const cancelled = { value: false };

    const id = setInterval(async () => {
      if (cancelled.value) return;
      try {
        // Use HEAD to check for changes before fetching the full JSON.
        const head = await fetch(reportUrl, { method: "HEAD", cache: "no-store" });
        const etag = head.headers.get("ETag") ?? head.headers.get("Last-Modified") ?? null;
        if (etag && etag === etagRef.current) {
          // Not changed — skip.
          return;
        }
        etagRef.current = etag;
        fetchReport(reportUrl, cancelled, { showLoading: false });
      } catch {
        // Network error during poll — ignore silently; the user will see the
        // previous state.
      }
    }, refreshIntervalMs);

    return () => {
      cancelled.value = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchUrl, refreshIntervalMs, reportUrl]);

  return { report, error, loading };
}
