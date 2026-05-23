import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { findViteRoot } from "./project-root.mjs";

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

  for (;;) {
    const viteRoot = findViteRoot(dir);
    if (viteRoot) return resolve(viteRoot);

    if (!laravelCandidate && existsSync(join(dir, "resources", "js"))) {
      laravelCandidate = dir;
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return laravelCandidate ?? resolve(cwd);
}

/**
 * Resolve the scan path (file-walk boundary): explicit positional relative to cwd;
 * otherwise cwd. `"."` is literal cwd, not project root.
 * @param {string | null | undefined} explicitPath user positional or null for default
 * @param {string} [cwd]
 * @returns {string} absolute path
 */
export function resolveScanPath(explicitPath, cwd = process.cwd()) {
  if (explicitPath != null && explicitPath !== "") {
    return resolve(cwd, explicitPath);
  }
  return resolve(cwd);
}

/**
 * Scan root (walk boundary) and project root (config, CSS, report parent).
 * @param {string | null | undefined} explicitPath
 * @param {string} [cwd]
 * @returns {{ scanPath: string; projectRoot: string }}
 */
export function resolveScanAndProjectRoots(explicitPath, cwd = process.cwd()) {
  const scanPath = resolveScanPath(explicitPath, cwd);
  const projectRoot = resolveProjectRoot(cwd);
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
  for (const arg of scannerArgs) {
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
