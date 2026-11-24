import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { UserConfig } from "vite";

const NUXT_CONFIG = /^nuxt\.config\.(ts|mts|js|mjs|cts|cjs)$/;
const STOP = "__dslinter_nuxt_config_captured__";

/**
 * Nuxt plugins that run Nuxt's own dev server, SSR bridge, devtools or build reporting.
 * The preview host serves a single component, so these are dropped.
 */
const SERVER_ONLY = [
  /^nuxt:(dev-server|vite-node-server|capture-client-build|dev-errors|dev-request-errors)$/,
  /^nuxt:(checker-bridge|build-report|perf|stable-entry|client-chunks|module-preload-polyfill)$/,
  /^nuxt:(environments|nitro:|dev-style-ssr|optimize-deps-hint|template-hmr)/,
  /devtools/i,
];

export function isNuxtApp(root: string): boolean {
  try {
    return readdirSync(root).some((name) => NUXT_CONFIG.test(name));
  } catch {
    return false;
  }
}

export type NuxtPreviewConfig = {
  config: UserConfig;
  /** CSS entries from `nuxt.options.css`, resolved to files. */
  styles: string[];
  /** Resolves `vite` the way Nuxt's builder does. */
  viteEntry: string;
  /** Public runtime config, as Nuxt injects it into `window.__NUXT__.config` for SPA pages. */
  runtimeConfig: Record<string, unknown>;
  close: () => Promise<void>;
};

/**
 * Load the client Vite config that Nuxt builds for `nuxt dev`.
 *
 * Nuxt apps keep their Vite setup in nuxt.config (Vue plugin, auto-imports, component
 * resolution, `~` aliases, CSS), and any vite.config file holds tooling only. Nuxt is
 * loaded in dev mode, its client config is captured, and the build is stopped before
 * Nuxt starts a server. The Nuxt instance stays open because its virtual templates
 * are served from memory; close it with the preview server.
 */
export async function loadNuxtPreviewConfig(root: string): Promise<NuxtPreviewConfig> {
  const appRequire = createRequire(join(root, "package.json"));
  const nuxtRequire = createRequire(appRequire.resolve("nuxt/package.json"));
  const kit = await import(pathToFileURL(nuxtRequire.resolve("@nuxt/kit")).href);
  const nuxt = await kit.loadNuxt({
    cwd: root,
    dev: true,
    ready: false,
    // SPA mode without devtools; the app manifest is served by Nuxt's dev server only.
    overrides: {
      ssr: false,
      devtools: { enabled: false },
      telemetry: false,
      experimental: { appManifest: false },
    },
  });
  let config: UserConfig | undefined;
  nuxt.hook("vite:extendConfig", (viteConfig: UserConfig, env: { isClient: boolean }) => {
    if (env.isClient) config = viteConfig;
  });
  nuxt.hook("vite:configResolved", (_: unknown, env: { isClient: boolean }) => {
    if (env.isClient) throw new Error(STOP);
  });
  try {
    await nuxt.ready();
    await kit.buildNuxt(nuxt);
  } catch (error) {
    if (!String(error).includes(STOP)) {
      await nuxt.close();
      throw error;
    }
  }
  if (!config) {
    await nuxt.close();
    throw new Error("Nuxt did not produce a client Vite config");
  }
  const plugins = (await Promise.all([config.plugins].flat(Infinity as 1)))
    .flat(Infinity as 1)
    .filter(
      (plugin: any) => plugin && !SERVER_ONLY.some((pattern) => pattern.test(plugin.name || "")),
    );
  const builderRequire = createRequire(nuxtRequire.resolve("@nuxt/vite-builder"));
  const styles = (nuxt.options.css as Array<string | { src: string }>)
    .map((entry) => (typeof entry === "string" ? entry : entry.src))
    .map((entry) => {
      if (isAbsolute(entry)) return entry;
      for (const [alias, target] of Object.entries(nuxt.options.alias as Record<string, string>))
        if (entry === alias || entry.startsWith(`${alias}/`))
          return resolve(target, entry.slice(alias.length + 1));
      return resolve(nuxt.options.srcDir, entry);
    })
    .filter(existsSync);
  return {
    config: {
      root: config.root,
      define: config.define,
      css: config.css,
      resolve: config.resolve,
      optimizeDeps: config.optimizeDeps,
      plugins: plugins as UserConfig["plugins"],
    },
    styles,
    viteEntry: builderRequire.resolve("vite"),
    runtimeConfig: {
      public: nuxt.options.runtimeConfig.public,
      app: nuxt.options.runtimeConfig.app,
    },
    close: () => nuxt.close(),
  };
}
