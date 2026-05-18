import net from "node:net";
import { spawnSync } from "node:child_process";

/**
 * @param {number} port
 * @param {string} [host]
 */
export function isPortInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      resolve(err && "code" in err && err.code === "EADDRINUSE");
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port, host);
  });
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
 */
export async function warnIfPortBusy(port) {
  if (!(await isPortInUse(port))) return false;
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
  return true;
}
