import { defineConfig, loadConfigFromFile, mergeConfig } from "vite";

/**
 * Merges the consumer's vite.config with the dslinter plugin.
 * Used by `npx dslinter` when a host Vite app is detected (`DSLINTER_VITE_ROOT`).
 */
export default defineConfig(async ({ command, mode }) => {
  const viteRoot = process.env.DSLINTER_VITE_ROOT?.trim() || process.cwd();
  const loaded = await loadConfigFromFile(
    { command, mode },
    undefined,
    viteRoot,
  );
  const userConfig = loaded?.config ?? {};
  const { default: dslinter } = await import("./plugin.ts");
  const scanRoot = process.env.DSLINTER_SCAN_ROOT?.trim() || viteRoot;
  const consumerViteRoot =
    process.env.DSLINTER_CONSUMER_VITE_ROOT?.trim() || viteRoot;
  return mergeConfig(
    userConfig,
    defineConfig({
      plugins: [dslinter({ scanRoot, consumerViteRoot })],
    }),
  );
});
