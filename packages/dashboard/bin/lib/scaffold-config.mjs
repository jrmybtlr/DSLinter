import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CONFIG_NAMES = [".dslint.json", "dslint.json"];

/**
 * @param {string} targetDir
 * @returns {"laravel" | "default"}
 */
export function detectInitLayout(targetDir) {
  if (existsSync(join(targetDir, "resources", "js"))) return "laravel";
  return "default";
}

/**
 * @param {string} targetDir
 * @returns {string | null}
 */
export function findDslintConfigPath(targetDir) {
  for (const name of CONFIG_NAMES) {
    const candidate = join(targetDir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * @param {string} targetDir
 * @param {string[]} candidates
 * @returns {string[]}
 */
function existingPaths(targetDir, candidates) {
  return candidates.filter((rel) => existsSync(join(targetDir, rel)));
}

/**
 * @param {string} targetDir
 * @param {"laravel" | "default"} layout
 */
function buildStarterConfig(targetDir, layout) {
  const includeCandidates =
    layout === "laravel"
      ? ["resources/js/Components", "resources/js/components", "resources/js"]
      : ["src/components", "src/ui", "src"];
  const cssCandidates =
    layout === "laravel"
      ? ["resources/css/app.css", "src/index.css"]
      : ["src/index.css", "src/styles.css", "src/app.css", "app/globals.css"];

  const includeDirs = existingPaths(targetDir, includeCandidates);
  const cssEntrypoints = existingPaths(targetDir, cssCandidates);
  const groupPrefix = includeDirs[0];

  return {
    include_dirs: includeDirs,
    ignore_globs: [],
    css_entrypoints: cssEntrypoints,
    ...(groupPrefix
      ? {
          playground_groups: {
            components: [groupPrefix],
          },
        }
      : {}),
  };
}

/**
 * @param {{ targetDir: string; layout: "laravel" | "default" }} opts
 * @returns {{ created: boolean; path: string; existed: boolean }}
 */
export function ensureDslintConfig(opts) {
  const targetDir = resolve(opts.targetDir);
  const existing = findDslintConfigPath(targetDir);
  if (existing) {
    return { created: false, path: existing, existed: true };
  }

  const configPath = join(targetDir, ".dslint.json");
  mkdirSync(targetDir, { recursive: true });
  const payload = buildStarterConfig(targetDir, opts.layout);
  writeFileSync(configPath, `${JSON.stringify(payload, null, 2)}\n`);
  return { created: true, path: configPath, existed: false };
}
