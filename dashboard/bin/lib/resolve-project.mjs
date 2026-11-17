import { findWorkspaceRoot } from "./workspace.mjs";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { findViteRoot } from "./project-root.mjs";

export const SCANNER_VALUE_FLAGS = new Set([
  "--serve",
  "--output",
  "-o",
  "--max-warnings",
  "--max-finding-delta",
  "--max-score-drop",
  "--baseline",
  "--dashboard-static",
]);

/**
 * Walk up from `cwd` and return the best project root for scanning.
 * 1. Nearest ancestor with vite.config.*
 * 2. Else nearest ancestor with resources/js/ (Laravel)
 * 3. Else cwd
 * @param {string} [cwd]
 * @returns {string} absolute path
 */
export function resolveProjectRoot(cwd = process.cwd()) {
  let dir = resolve(cwd);
  let laravelCandidate = null;
  let packageCandidate = null;

  for (;;) {
    const viteRoot = findViteRoot(dir);
    if (viteRoot) return resolve(viteRoot);

    if (!laravelCandidate && existsSync(join(dir, "resources", "js"))) {
      laravelCandidate = dir;
    }
    if (!packageCandidate && existsSync(join(dir, "package.json"))) packageCandidate = dir;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return laravelCandidate ?? packageCandidate ?? resolve(cwd);
}

/**
 * Resolve the scan path (file-walk boundary): explicit positional relative to cwd;
 * otherwise the workspace or nearest app. `"."` is literal cwd.
 * @param {string | null | undefined} explicitPath user positional or null for default
 * @param {string} [cwd]
 * @returns {string} absolute path
 */
export function resolveScanPath(explicitPath, cwd = process.cwd()) {
  if (explicitPath != null && explicitPath !== "") {
    return resolve(cwd, explicitPath);
  }
  return findWorkspaceRoot(cwd) ?? resolveProjectRoot(cwd);
}

/**
 * Scan root (walk boundary) and project root (config, CSS, report parent).
 * @param {string | null | undefined} explicitPath
 * @param {string} [cwd]
 * @returns {{ scanPath: string; projectRoot: string }}
 */
export function resolveScanAndProjectRoots(explicitPath, cwd = process.cwd()) {
  const scanPath = resolveScanPath(explicitPath, cwd);
  const projectRoot = resolveProjectRoot(scanPath);
  return { scanPath, projectRoot };
}

/**
 * Replace or insert the scanner positional path in argv.
 * @param {string[]} scannerArgs
 * @param {string} scanPath absolute scan path
 * @returns {string[]}
 */
export function withScannerScanPath(scannerArgs, scanPath) {
  const out = [];
  let replaced = false;
  for (let i = 0; i < scannerArgs.length; i++) {
    const arg = scannerArgs[i];
    if (SCANNER_VALUE_FLAGS.has(arg)) {
      out.push(arg);
      if (i + 1 < scannerArgs.length) out.push(scannerArgs[++i]);
      continue;
    }
    if (!replaced && !arg.startsWith("-")) {
      out.push(scanPath);
      replaced = true;
      continue;
    }
    out.push(arg);
  }
  if (!replaced) out.unshift(scanPath);
  return out;
}
