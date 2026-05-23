import { readEnv } from "./env.mjs";

/** @typedef {import("node:process").ProcessEnv} ProcessEnv */

/** Default scanner HTTP port when `DSLINTER_SERVE_PORT` is unset. */
export const DEFAULT_SERVE_PORT = 7878;

/**
 * Resolve scanner HTTP port from `DSLINTER_SERVE_PORT` or {@link DEFAULT_SERVE_PORT}.
 * @param {ProcessEnv} [env]
 * @returns {number}
 */
export function resolveServePort(env = process.env) {
  const fromEnv = readEnv("SERVE_PORT", env);
  if (fromEnv) {
    const n = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(n) && n > 0 && n <= 65535) return n;
  }
  return DEFAULT_SERVE_PORT;
}
