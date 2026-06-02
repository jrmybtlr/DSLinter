import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { enrichPlaygroundsFromTs } from "../../bin/lib/enrich-playgrounds-from-ts.mjs";
import { runScannerSync } from "../../bin/lib/run-scanner.mjs";
import type { McpConfig } from "./config";
import { normalizeReportPaths } from "./normalize-paths";
import type { WorkspaceReport } from "../types/report";

const require = createRequire(import.meta.url);
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export type ReportCacheState = {
  report: WorkspaceReport | null;
  loadedAt: number;
  source: "file" | "scan" | "dev";
};

export class ReportCache {
  private state: ReportCacheState = {
    report: null,
    loadedAt: 0,
    source: "file",
  };
  private sseAbort: AbortController | null = null;
  private readonly config: McpConfig;

  constructor(config: McpConfig) {
    this.config = config;
  }

  async getReport(opts: { fresh?: boolean } = {}): Promise<WorkspaceReport> {
    if (!opts.fresh && this.state.report && this.isFresh()) {
      return this.state.report;
    }

    const fromDev = await this.tryLoadDevServer();
    if (fromDev) {
      this.setState(fromDev, "dev");
      return fromDev;
    }

    if (!opts.fresh && (await this.tryLoadFile())) {
      return this.state.report!;
    }

    const scanned = await this.runScan();
    this.setState(scanned, "scan");
    return scanned;
  }

  startDevWatch(): void {
    if (this.sseAbort) return;
    this.sseAbort = new AbortController();
    void this.watchDevSse(this.sseAbort.signal);
  }

  stopDevWatch(): void {
    this.sseAbort?.abort();
    this.sseAbort = null;
  }

  invalidate(): void {
    this.state.loadedAt = 0;
  }

  reportHash(): string | null {
    if (!this.state.report) return null;
    const json = JSON.stringify(this.state.report);
    return createHash("sha256").update(json).digest("hex");
  }

  private isFresh(): boolean {
    return Date.now() - this.state.loadedAt < this.config.ttlMs;
  }

  private setState(report: WorkspaceReport, source: ReportCacheState["source"]): void {
    this.state = { report, loadedAt: Date.now(), source };
  }

  private async tryLoadFile(): Promise<boolean> {
    try {
      const st = await stat(this.config.reportPath);
      if (Date.now() - st.mtimeMs > this.config.ttlMs) return false;
      const raw = await readFile(this.config.reportPath, "utf8");
      const report = normalizeReportPaths(JSON.parse(raw) as WorkspaceReport);
      this.setState(report, "file");
      return true;
    } catch {
      return false;
    }
  }

  private async tryLoadDevServer(): Promise<WorkspaceReport | null> {
    const url = `${this.config.devUrl.replace(/\/$/, "")}/dslinter-report.json`;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return null;
      const report = normalizeReportPaths((await res.json()) as WorkspaceReport);
      const reportRoot = resolve(report.root);
      const projectRoot = resolve(this.config.projectRoot);
      if (reportRoot !== projectRoot) return null;
      return report;
    } catch {
      return null;
    }
  }

  private async watchDevSse(signal: AbortSignal): Promise<void> {
    const url = `${this.config.devUrl.replace(/\/$/, "")}/events`;
    try {
      const res = await fetch(url, { headers: { Accept: "text/event-stream" }, signal });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("data: updated")) {
          buffer = "";
          this.invalidate();
          const fromDev = await this.tryLoadDevServer();
          if (fromDev) this.setState(fromDev, "dev");
        }
      }
    } catch {
      // dev server not running
    }
  }

  private async runScan(): Promise<WorkspaceReport> {
    const args = [
      this.config.scanPath,
      "--output",
      this.config.reportPath,
      "--json",
    ];

    let json = "";
    try {
      const { scanWorkspaceJson } = require(join(packageRoot, "index.cjs"));
      json = scanWorkspaceJson(this.config.scanPath, false);
    } catch {
      const code = runScannerSync(args, {
        projectRoot: this.config.projectRoot,
        captureStdout: true,
      });
      if (code !== 0) {
        throw new Error(`dslinter scan failed with exit code ${code}`);
      }
      json = await readFile(this.config.reportPath, "utf8");
    }

    let report = normalizeReportPaths(JSON.parse(json) as WorkspaceReport);
    await enrichPlaygroundsFromTs({
      projectRoot: this.config.projectRoot,
      reportPath: this.config.reportPath,
    });

    try {
      const enriched = await readFile(this.config.reportPath, "utf8");
      report = normalizeReportPaths(JSON.parse(enriched) as WorkspaceReport);
    } catch {
      // use scan-only report
    }

    await mkdir(dirname(this.config.reportPath), { recursive: true });
    await writeFile(this.config.reportPath, JSON.stringify(report, null, 2));

    return report;
  }
}

export type BaselineStore = {
  hash: string;
  saved_at: string;
  scores: WorkspaceReport["scores"];
  finding_count: number;
};

export async function loadBaseline(projectRoot: string): Promise<BaselineStore | null> {
  const path = join(projectRoot, ".dslinter", "mcp-baseline.json");
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as BaselineStore;
  } catch {
    return null;
  }
}

export async function saveBaseline(
  projectRoot: string,
  report: WorkspaceReport,
  hash: string,
): Promise<void> {
  const dir = join(projectRoot, ".dslinter");
  await mkdir(dir, { recursive: true });
  const payload: BaselineStore = {
    hash,
    saved_at: new Date().toISOString(),
    scores: report.scores,
    finding_count: report.findings?.length ?? 0,
  };
  await writeFile(join(dir, "mcp-baseline.json"), JSON.stringify(payload, null, 2));
}
