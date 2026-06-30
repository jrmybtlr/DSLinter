#!/usr/bin/env node
/**
 * MCP stdio server entry (run via `node --experimental-strip-types` or vitest).
 */
import { buildMcpConfig } from "./config";
import { runMcpSelfTest, runMcpServer } from "./server";

export type McpStartOptions = {
  cwd?: string;
  scanPath: string;
  projectRoot: string;
  reportPath?: string;
};

export async function startMcp(opts: McpStartOptions): Promise<void> {
  const config = buildMcpConfig({
    cwd: opts.cwd,
    scanPath: opts.scanPath,
    projectRoot: opts.projectRoot,
    reportPath: opts.reportPath,
  });

  if (process.argv.includes("--self-test")) {
    await runMcpSelfTest(config);
    return;
  }

  await runMcpServer(config);
}
