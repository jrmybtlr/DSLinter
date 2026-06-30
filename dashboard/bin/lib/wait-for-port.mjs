import net from "node:net";

/**
 * @param {number} port
 * @param {{ host?: string; timeoutMs?: number; intervalMs?: number }} [opts]
 */
export function waitForPort(port, opts = {}) {
  const host = opts.host ?? "127.0.0.1";
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const intervalMs = opts.intervalMs ?? 100;
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      if (Date.now() > deadline) {
        reject(new Error(`dslinter: timed out waiting for ${host}:${port}`));
        return;
      }
      const socket = net.connect({ host, port }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        setTimeout(tryConnect, intervalMs);
      });
    };
    tryConnect();
  });
}
