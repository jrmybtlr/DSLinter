import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { embedGlobKeyFromRelPath } from "../src/playground/embedGlobKey";

const CONFIG_NAMES = [".dslinter.json", "dslinter.json"];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "vendor",
  ".git",
  "dist",
  "build",
  "dashboard-dist",
  "storage",
  "bootstrap",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".cache",
]);

const SOURCE_EXT = /\.(tsx|jsx)$/;

function findConfigPath(startDir: string): string | null {
  let dir = resolve(startDir);
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function projectRootForConfig(startDir: string): string {
  const configPath = findConfigPath(startDir);
  return configPath ? dirname(configPath) : resolve(startDir);
}

export function readIncludeDirs(projectRoot: string): string[] | null {
  const configPath = findConfigPath(projectRoot);
  if (!configPath) return null;
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      include_dirs?: string[];
    };
    if (Array.isArray(parsed.include_dirs) && parsed.include_dirs.length > 0) {
      return parsed.include_dirs;
    }
  } catch {
    return null;
  }
  return null;
}

function pathMatchesIncludePrefix(relFromProject: string, prefix: string): boolean {
  const norm = prefix.trim().replace(/\\/g, "/").replace(/\/$/, "");
  if (!norm) return false;
  if (process.platform === "darwin" || process.platform === "win32") {
    const rel = relFromProject.toLowerCase();
    const pref = norm.toLowerCase();
    return rel === pref || rel.startsWith(`${pref}/`);
  }
  return relFromProject === norm || relFromProject.startsWith(`${norm}/`);
}

function matchesIncludeDirs(
  relFromProject: string,
  includeDirs: string[] | null,
): boolean {
  if (!includeDirs) return true;
  return includeDirs.some((dir) =>
    pathMatchesIncludePrefix(relFromProject, dir),
  );
}

function walkDir(
  dir: string,
  projectRoot: string,
  includeDirs: string[] | null,
  out: string[],
): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".") && ent.name !== ".") continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      walkDir(full, projectRoot, includeDirs, out);
    } else if (ent.isFile() && SOURCE_EXT.test(ent.name)) {
      const relFromProject = relative(projectRoot, full).replace(/\\/g, "/");
      if (!matchesIncludeDirs(relFromProject, includeDirs)) continue;
      out.push(relFromProject);
    }
  }
}

/**
 * Collect repo-relative posix paths for `.tsx`/`.jsx` files under `scanRoot`.
 * Config and `include_dirs` resolve from the nearest project root; only files
 * under `scanRoot` are walked.
 */
export function collectScanModuleRelPaths(scanRoot: string): string[] {
  const scanAbs = resolve(scanRoot);
  const projectRoot = projectRootForConfig(scanAbs);
  const includeDirs = readIncludeDirs(projectRoot);
  const out: string[] = [];

  walkDir(scanAbs, projectRoot, includeDirs, out);

  out.sort();
  return out;
}

export { embedGlobKeyFromRelPath };
