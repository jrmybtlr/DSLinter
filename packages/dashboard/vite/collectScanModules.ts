import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

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

/**
 * Collect repo-relative posix paths for `.tsx`/`.jsx` files under `scanRoot`.
 */
export function collectScanModuleRelPaths(scanRoot: string): string[] {
  const root = resolve(scanRoot);
  const out: string[] = [];

  function walk(dir: string): void {
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
        walk(full);
      } else if (ent.isFile() && SOURCE_EXT.test(ent.name)) {
        out.push(relative(root, full).replace(/\\/g, "/"));
      }
    }
  }

  walk(root);
  out.sort();
  return out;
}

/**
 * Virtual module map key for a scanner `rel_path` (embed convention).
 */
export function embedGlobKeyFromRelPath(relPath: string): string {
  const trimmed = relPath.replace(/^\/+/, "");
  return `@dslint-scan/${trimmed}`;
}
