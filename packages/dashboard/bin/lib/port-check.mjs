import net from "node:net";
import { spawnSync } from "node:child_process";

/**
 * @param {number} port
 * @param {string} host
 */
function isListening(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(400, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Whether something is already accepting connections on `port`.
 * @param {number} port
 * @param {string} [host] When set, only that address (e.g. `127.0.0.1` for the Rust scanner).
 */
export async function isPortInUse(port, host) {
  if (host) return isListening(port, host);
  if (await isListening(port, "127.0.0.1")) return true;
  try {
    if (await isListening(port, "::1")) return true;
  } catch {
    // IPv6 unavailable
  }
  return false;
}

/**
 * @param {number} start
 * @param {number} [tries]
 */
export async function findAvailablePort(start, tries = 32) {
  for (let i = 0; i < tries; i++) {
    const port = start + i;
    if (port > 65535) break;
    if (!(await isPortInUse(port))) return port;
  }
  throw new Error(`dslinter: no free port found near ${start}`);
}

/**
 * @param {number} port
 */
export function describePortOccupant(port) {
  if (process.platform === "win32") {
    const r = spawnSync("netstat", ["-ano"], { encoding: "utf8" });
    const line = (r.stdout ?? "")
      .split("\n")
      .find((l) => l.includes(`:${port}`) && l.includes("LISTENING"));
    return line?.trim() ?? null;
  }
  const r = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
  });
  const lines = (r.stdout ?? "").trim().split("\n").filter(Boolean);
  if (lines.length < 2) return null;
  return lines.slice(1).join("\n");
}

/**
 * @param {number} port
 * @param {{ silent?: boolean }} [opts]
 */
export async function warnIfPortBusy(port, opts = {}) {
  if (!(await isPortInUse(port, "127.0.0.1"))) return false;
  if (!opts.silent) {
    const detail = describePortOccupant(port);
    process.stderr.write(
      [
        "",
        `[dslinter] Port ${port} is already in use — scanner cannot bind.`,
        detail ? `  ${detail.replace(/\n/g, "\n  ")}` : "",
        `  Stop the old process, then restart. Example: lsof -nP -iTCP:${port} -sTCP:LISTEN`,
        "  If you already have `npm run dev` running, open the Vite URL it printed (e.g. http://localhost:5173/).",
        "",
      ].join("\n"),
    );
  }
  return true;
}
