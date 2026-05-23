import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
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

function findConfigPath(projectRoot: string): string | null {
  for (const name of CONFIG_NAMES) {
    const candidate = join(projectRoot, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readIncludeDirs(projectRoot: string): string[] | null {
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

function walkDir(dir: string, projectRoot: string, out: string[]): void {
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
      walkDir(full, projectRoot, out);
    } else if (ent.isFile() && SOURCE_EXT.test(ent.name)) {
      out.push(relative(projectRoot, full).replace(/\\/g, "/"));
    }
  }
}

/**
 * Collect repo-relative posix paths for `.tsx`/`.jsx` files under `scanRoot`.
 * When `.dslinter.json` defines `include_dirs`, only those directories are walked.
 */
export function collectScanModuleRelPaths(scanRoot: string): string[] {
  const root = resolve(scanRoot);
  const includeDirs = readIncludeDirs(root);
  const out: string[] = [];

  if (includeDirs) {
    for (const dir of includeDirs) {
      walkDir(join(root, dir), root, out);
    }
  } else {
    walkDir(root, root, out);
  }

  out.sort();
  return out;
}

export { embedGlobKeyFromRelPath };
