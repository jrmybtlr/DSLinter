import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** @returns {string} `packages/dashboard` root (embed SPA + library). */
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
 * Rebuild `dashboard-dist/` when embed sources are newer than the bundle (or dist is missing).
 * @param {string} root
 */
export function ensureDashboardBuilt(root = packageRoot) {
  const distIndex = join(root, "dashboard-dist", "index.html");
  const force =
    process.env.DSLINTER_REBUILD_DASHBOARD === "1" ||
    process.env.DSLINTER_REBUILD_DASHBOARD?.toLowerCase() === "true";

  let needsBuild = force || !existsSync(distIndex);
  if (!needsBuild) {
    const distMtime = statSync(distIndex).mtimeMs;
    for (const sub of ["src", "embed"]) {
      const dir = join(root, sub);
      if (existsSync(dir) && maxMtimeInDir(dir) > distMtime) {
        needsBuild = true;
        break;
      }
    }
    const configPath = join(root, "vite.config.ts");
    if (existsSync(configPath) && statSync(configPath).mtimeMs > distMtime) {
      needsBuild = true;
    }
  }

  if (!needsBuild) return dashboardDirIfReady(join(root, "dashboard-dist"));

  process.stderr.write("[dslinter] Building dashboard bundle (dashboard-dist)…\n");
  const result = spawnSync("npm", ["run", "build:dashboard"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("dslinter: dashboard build failed");
  }
  return dashboardDirIfReady(join(root, "dashboard-dist"));
}

/** @returns {boolean} */
export function hasEmbedDashboard() {
  return existsSync(join(packageRoot, "index.html"));
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
 * 2. `DSLINT_DASHBOARD_STATIC` — absolute or cwd-relative (temp/gitignored dirs ok)
 * 3. `dashboard-dist/` next to the installed `dslinter` package
 *
 * @returns {string | null}
 */
export function resolveBundledDashboardDir() {
  const optOut = process.env.DSLINTER_NO_BUNDLED_DASHBOARD?.trim();
  if (optOut === "1" || optOut?.toLowerCase() === "true") return null;

  const fromEnv = process.env.DSLINT_DASHBOARD_STATIC?.trim();
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
