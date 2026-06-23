import { readFileSync } from "node:fs";
import { join } from "node:path";
import { networkInterfaces } from "node:os";

/** @returns {string[]} Non-loopback IPv4 addresses (LAN). */
export function getLanIpv4Addresses() {
  /** @type {string[]} */
  const addrs = [];
  const ifaces = networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      const family = entry.family;
      const isIpv4 =
        family === "IPv4" || family === 4 || String(family) === "IPv4";
      if (isIpv4 && !entry.internal) {
        addrs.push(entry.address);
      }
    }
  }
  return addrs;
}

/**
 * @param {number} port
 */
export function scannerApiUrl(port) {
  return `http://127.0.0.1:${port}/`;
}

/**
 * Status line for the MCP data source (not a shell command).
 * @param {number} port
 * @param {boolean} apiAvailable
 */
export function formatMcpDataStatus(port, apiAvailable) {
  if (!apiAvailable) {
    return "offline — agents use report file";
  }
  return `live @ http://127.0.0.1:${port}`;
}

/**
 * @param {boolean} [mcpConfigured]
 */
export function formatMcpAgentHint(mcpConfigured = false) {
  if (mcpConfigured) {
    return "AI agents: dslinter in .cursor/mcp.json (Cursor spawns MCP)";
  }
  return "AI agents: add dslinter to .cursor/mcp.json";
}

/**
 * @param {string} projectRoot
 */
export function hasMcpConfig(projectRoot) {
  try {
    const raw = readFileSync(join(projectRoot, ".cursor", "mcp.json"), "utf8");
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.mcpServers?.dslinter);
  } catch {
    return false;
  }
}

/**
 * @param {string | null | undefined} dashboardUrl
 * @param {number} apiPort
 */
export function dashboardSharesScannerPort(dashboardUrl, apiPort) {
  if (!dashboardUrl) return false;
  return dashboardUrl.includes(`:${apiPort}`);
}

/**
 * @param {number} port
 * @param {string} [host]
 */
export function httpUrl(port, host = "127.0.0.1") {
  return `http://${host}:${port}/`;
}
