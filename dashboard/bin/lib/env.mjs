/** @typedef {import("node:process").ProcessEnv} ProcessEnv */

/**
 * Read `DSLINTER_*` environment variables.
 * @param {string} name Suffix after the prefix, e.g. `"SERVE_PORT"`.
 * @param {ProcessEnv} [env]
 * @returns {string | undefined}
 */
export function readEnv(name, env = process.env) {
  return env[`DSLINTER_${name}`]?.trim() || undefined;
}

/**
 * @param {string} name
 * @param {string} [value]
 * @param {ProcessEnv} [env]
 */
export function envIs(name, value = "1", env = process.env) {
  return readEnv(name, env) === value;
}
