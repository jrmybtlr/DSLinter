import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadConfigFromFile, mergeConfig } from "vite";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Merges the consumer's vite.config with the dslinter plugin.
 * Used by `npx dslinter` when a host Vite app is detected (`DSLINT_VITE_ROOT`).
 */
export default defineConfig(async ({ command, mode }) => {
  const viteRoot = process.env.DSLINT_VITE_ROOT?.trim() || process.cwd();
  const loaded = await loadConfigFromFile(
    { command, mode },
    undefined,
    viteRoot,
  );
  const userConfig = loaded?.config ?? {};
  const { default: dslinter } = await import("./plugin.ts");
  return mergeConfig(
    userConfig,
    defineConfig({
      plugins: [dslinter()],
    }),
  );
});
