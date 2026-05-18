import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const VITE_CONFIG_NAMES = ["vite.config.ts", "vite.config.js", "vite.config.mjs", "vite.config.cjs"];

/**
 * @param {string} startDir
 * @returns {string | null}
 */
export function findViteRoot(startDir) {
  let dir = resolve(startDir);
  for (;;) {
    for (const name of VITE_CONFIG_NAMES) {
      if (existsSync(join(dir, name))) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * @param {string} scanPath
 * @param {string | null} outputFlag
 * @returns {string}
 */
export function defaultReportPath(scanPath, outputFlag) {
  if (outputFlag) return resolve(outputFlag);
  return resolve(scanPath, "public", "dslint-report.json");
}

/**
 * @returns {number}
 */
export function defaultServePort() {
  const fromEnv = process.env.DSLINT_SERVE_PORT?.trim();
  if (fromEnv) {
    const n = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(n) && n > 0 && n <= 65535) return n;
  }
  return 7878;
}

/**
 * Pre-built dashboard SPA shipped with the npm package (`dashboard-dist/`).
 * @returns {string | null} absolute path when index.html exists
 */
export function resolveBundledDashboardDir() {
  const dir = join(packageRoot, "dashboard-dist");
  if (existsSync(join(dir, "index.html"))) return dir;
  return null;
}

/**
 * Resolve vite CLI entry from a project directory (supports hoisted / workspace installs).
 * @param {string} projectDir
 * @returns {string | null}
 */
export function resolveViteBin(projectDir) {
  let dir = resolve(projectDir);
  for (;;) {
    const pkgJson = join(dir, "package.json");
    if (existsSync(pkgJson)) {
      try {
        const req = createRequire(pkgJson);
        return req.resolve("vite/bin/vite.js");
      } catch {
        // try parent
      }
    }
    const nested = join(dir, "node_modules", "vite", "bin", "vite.js");
    if (existsSync(nested)) return nested;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
