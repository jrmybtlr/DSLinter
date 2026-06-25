import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveServePort } from "./constants.mjs";
import { readEnv } from "./env.mjs";
import { REPORT_FILE_NAME } from "./paths.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** @returns {string} `dashboard` root (embed SPA + library). */
export function getDashboardPackageRoot() {
  return packageRoot;
}

/**
 * @param {string} dir
 * @param {number} [latest]
 */
function maxMtimeInDir(dir, latest = 0) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      latest = maxMtimeInDir(p, latest);
    } else if (ent.isFile()) {
      latest = Math.max(latest, statSync(p).mtimeMs);
    }
  }
  return latest;
}

/**
 * @param {string} [root]
 * @returns {boolean} true when the embed SPA dev server can start (npm or monorepo).
 */
export function canRunEmbedVite(root = packageRoot) {
  return (
    existsSync(join(root, "index.html")) ||
    existsSync(join(root, "embed", "main.tsx"))
  );
}

/**
 * @param {string} [root]
 * @returns {string | null} absolute path to published embed Vite config
 */
export function embedServeConfigPath(root = packageRoot) {
  const configPath = join(root, "vite", "embed-serve.config.ts");
  return existsSync(configPath) ? configPath : null;
}

/**
 * @param {string} [root]
 * @returns {boolean} true when embed SPA sources exist for building dashboard-dist.
 */
export function hasEmbedDashboard(root = packageRoot) {
  return existsSync(join(root, "index.html"));
}

/**
 * Rebuild `dashboard-dist/` when embed sources are newer than the bundle (or dist is missing).
 * Published npm installs omit embed sources; use prebuilt `dashboard-dist/` only.
 * @param {string} root
 */
export function ensureDashboardBuilt(root = packageRoot) {
  const distDir = join(root, "dashboard-dist");
  const canBuildFromSource =
    existsSync(join(root, "index.html")) &&
    existsSync(join(root, "vite.config.ts"));
  if (!canBuildFromSource) {
    return dashboardDirIfReady(distDir);
  }

  const distIndex = join(distDir, "index.html");
  const force =
    process.env.DSLINTER_REBUILD_DASHBOARD === "1" ||
    process.env.DSLINTER_REBUILD_DASHBOARD?.toLowerCase() === "true";

  let needsBuild = force || !existsSync(distIndex);
  if (!needsBuild) {
    const distMtime = statSync(distIndex).mtimeMs;
    const embedDir = join(root, "embed");
    if (existsSync(embedDir) && maxMtimeInDir(embedDir) > distMtime) {
      needsBuild = true;
    }
    const configPath = join(root, "vite.config.ts");
    if (existsSync(configPath) && statSync(configPath).mtimeMs > distMtime) {
      needsBuild = true;
    }
  }

  if (!needsBuild) return dashboardDirIfReady(distDir);

  process.stderr.write("[dslinter] Building dashboard bundle (dashboard-dist)…\n");
  const result = spawnSync("npm", ["run", "build:dashboard"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("dslinter: dashboard build failed");
  }
  return dashboardDirIfReady(distDir);
}

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
  const scanAbs = resolve(scanPath);
  const viteRoot = findViteRoot(scanAbs);
  if (viteRoot && resolve(viteRoot) !== scanAbs) {
    return resolve(viteRoot, "public", REPORT_FILE_NAME);
  }
  return resolve(scanAbs, "public", REPORT_FILE_NAME);
}

/**
 * Log when scan was promoted from a subdirectory to the project root.
 * @param {{ promoted: boolean; originalPath?: string; scanPath: string }} info
 * @deprecated Subdirectory scans are no longer promoted; use {@link logScanScopeHint}.
 */
export function logScanRootPromotion(info) {
  if (!info.promoted || !info.originalPath) return;
  process.stderr.write(
    `dslinter: using project root ${info.scanPath} (was ${info.originalPath}).\n`,
  );
}

/**
 * Log when scanning a subdirectory while config/report use the project root.
 * @param {{
 *   scanPath: string;
 *   projectRoot: string;
 *   explicitScanPath: string | null;
 * }} info
 */
export function logScanScopeHint(info) {
  const scanAbs = resolve(info.scanPath);
  const projectAbs = resolve(info.projectRoot);
  if (scanAbs === projectAbs) return;

  const implicit =
    info.explicitScanPath == null ||
    info.explicitScanPath === "" ||
    info.explicitScanPath === ".";
  if (!implicit) return;

  const rel =
    relative(projectAbs, scanAbs).replace(/\\/g, "/") || scanAbs;
  process.stderr.write(
    `dslinter: scanning ${rel} (project root: ${projectAbs}). Run from repo root for a full-repo scan.\n`,
  );
}

/**
 * @deprecated Use {@link logScanRootPromotion} after {@link promoteScanToProjectRoot}.
 * @param {string} scanPath absolute or relative scan path
 * @param {{ outputPath?: string | null }} [opts]
 */
export function warnIfSubdirectoryScan(scanPath, opts = {}) {
  const scanAbs = resolve(scanPath);
  const viteRoot = findViteRoot(scanAbs);
  if (!viteRoot) return;
  const viteAbs = resolve(viteRoot);
  if (scanAbs === viteAbs) return;

  process.stderr.write(
    "dslinter: using project root for scan (subdirectory paths shorten playground rel_path).\n",
  );
  if (!opts.outputPath) {
    const reportAt = defaultReportPath(viteAbs, null);
    process.stderr.write(`dslinter: report → ${reportAt}\n`);
  }
}

/**
 * @returns {number}
 */
export function defaultServePort() {
  return resolveServePort();
}

/**
 * @param {string} dir
 * @returns {string | null} canonical absolute path when `index.html` exists
 */
function dashboardDirIfReady(dir) {
  const indexHtml = join(dir, "index.html");
  if (!existsSync(indexHtml)) return null;
  try {
    return realpathSync(dir);
  } catch {
    return resolve(dir);
  }
}

/**
 * Pre-built dashboard SPA for `--dashboard-static` (same port as `--serve`).
 *
 * Resolution order:
 * 1. Skip when `DSLINTER_NO_BUNDLED_DASHBOARD=1`
 * 2. `DSLINTER_DASHBOARD_STATIC` — absolute or cwd-relative (temp/gitignored dirs ok)
 * 3. `dashboard-dist/` next to the installed `dslinter` package
 *
 * @returns {string | null}
 */
export function resolveBundledDashboardDir() {
  const optOut = process.env.DSLINTER_NO_BUNDLED_DASHBOARD?.trim();
  if (optOut === "1" || optOut?.toLowerCase() === "true") return null;

  const fromEnv = readEnv("DASHBOARD_STATIC");
  if (fromEnv) {
    const dir = isAbsolute(fromEnv) ? normalize(fromEnv) : resolve(process.cwd(), fromEnv);
    return dashboardDirIfReady(dir);
  }

  try {
    return ensureDashboardBuilt(packageRoot);
  } catch {
    return dashboardDirIfReady(join(packageRoot, "dashboard-dist"));
  }
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
