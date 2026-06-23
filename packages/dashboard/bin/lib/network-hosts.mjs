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
 * @param {number} port
 * @param {boolean} apiAvailable
 */
export function formatMcpConnection(port, apiAvailable) {
  const cmd = "npx dslinter mcp";
  if (!apiAvailable) {
    return `${cmd} (uses report file when scanner offline)`;
  }
  return `${cmd} → http://127.0.0.1:${port}`;
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
