import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const CONFIG_FILE_NAMES = [".dslinter.json", "dslinter.json"];
const DEFAULT_CONFIG_FILE_NAME = ".dslinter.json";

/**
 * @param {string} projectRoot
 * @returns {string}
 */
export function findDslintConfigPath(projectRoot) {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = join(projectRoot, name);
    if (existsSync(candidate)) return candidate;
  }
  return join(projectRoot, DEFAULT_CONFIG_FILE_NAME);
}

/**
 * @param {string} projectRoot
 * @param {string} componentName
 * @returns {{ hidden_components: string[] }}
 */
export function hideComponentInDslintConfig(projectRoot, componentName) {
  const name = String(componentName ?? "").trim();
  if (!name) {
    throw new Error("component name is required");
  }
  const configPath = findDslintConfigPath(projectRoot);
  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf8"));
    } catch (e) {
      throw new Error(`Invalid JSON in ${configPath}: ${e.message}`);
    }
  }
  const hidden = Array.isArray(config.hidden_components)
    ? [...config.hidden_components]
    : [];
  if (!hidden.includes(name)) hidden.push(name);
  config.hidden_components = hidden;
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return { hidden_components: hidden };
}
