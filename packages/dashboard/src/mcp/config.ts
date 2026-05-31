import { resolve } from "node:path";

const REPORT_FILE_NAME = "dslinter-report.json";

function resolveReportFilePath(scanRoot: string): string {
  const fromEnv = process.env.DSLINTER_REPORT_PATH?.trim();
  if (fromEnv) return resolve(fromEnv);
  return resolve(scanRoot, "public", REPORT_FILE_NAME);
}

export type McpConfig = {
  cwd: string;
  scanPath: string;
  projectRoot: string;
  reportPath: string;
  devUrl: string;
  ttlMs: number;
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Build MCP config from env + explicit paths (set by bin/modes/mcp.mjs). */
export function buildMcpConfig(opts: {
  cwd?: string;
  scanPath: string;
  projectRoot: string;
  reportPath?: string;
  devUrl?: string;
  ttlMs?: number;
}): McpConfig {
  const cwd = opts.cwd ?? process.cwd();
  const scanPath = resolve(
    process.env.DSLINTER_SCAN_ROOT?.trim() || opts.scanPath,
  );
  const projectRoot = resolve(opts.projectRoot);
  const reportPath = resolve(
    process.env.DSLINTER_REPORT_PATH?.trim() ||
      opts.reportPath ||
      resolveReportFilePath(scanPath),
  );
  const devUrl =
    opts.devUrl ??
    process.env.DSLINTER_MCP_DEV_URL?.trim() ??
    "http://127.0.0.1:7878";
  const ttlMs = opts.ttlMs ?? envInt("DSLINTER_MCP_TTL_MS", 60_000);

  return { cwd, scanPath, projectRoot, reportPath, devUrl, ttlMs };
}
