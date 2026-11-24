import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Plugin, UserConfig, ViteDevServer } from "vite";
import { transformWithEsbuild } from "vite";
import { previewModuleLoader } from "./previewModuleLoader";
import { cachedUseClassy } from "./cachedUseClassy";
import { workspaceCacheDir } from "../bin/lib/cache.mjs";
import { loadConsumerAliases } from "./loadConsumerAliases";
import { findPreviewAdapter, type PreviewApp } from "./previewAdapter";
import { isNuxtApp, loadNuxtPreviewConfig } from "./nuxtConfig";

export type { PreviewApp } from "./previewAdapter";
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function json(path: string): Record<string, any> {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export function detectPreviewStyles(app: PreviewApp, config: UserConfig = {}): string[] {
  const explicit = json(join(app.root, ".dslinter.json")).css_entrypoints;
  const shadcn = json(join(app.root, "components.json")).tailwind?.css;
  if (Array.isArray(explicit) && explicit.length)
    return explicit.map((path: string) => resolve(app.root, path)).filter(existsSync);
  if (typeof shadcn === "string" && existsSync(resolve(app.root, shadcn)))
    return [resolve(app.root, shadcn)];
  const input = config.build?.rollupOptions?.input;
  const inputs = typeof input === "string" ? [input] : Object.values(input || {}).flat();
  const styles = new Set<string>();
  const roots = [app.root, ...(config.root ? [resolve(app.root, config.root)] : [])];
  for (const root of roots)
    for (const entry of [
      ...inputs,
      "src/main.tsx",
      "src/main.ts",
      "src/main.jsx",
      "src/main.js",
      "resources/js/app.tsx",
      "resources/js/app.ts",
    ]) {
      const path = resolve(root, entry);
      if (!existsSync(path)) continue;
      if (/\.(css|scss|sass|less)$/.test(path)) {
        styles.add(path);
        continue;
      }
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(
        /import\s*(?:[^'";]+from\s*)?['"]([^'"]+\.(?:css|scss|sass|less))['"]/g,
      )) {
        const imported = resolve(dirname(path), match[1]);
        if (existsSync(imported)) styles.add(imported);
      }
    }
  return [...styles];
}

/** Backend entry integrations generate routes/manifests or require a running backend. */
export function previewSafePlugins(plugins: any[]): any[] {
  return plugins
    .flat(Infinity)
    .filter(
      (plugin) =>
        plugin &&
        !/^(laravel|inertia|wayfinder)(:|-|$)/i.test(plugin.name || "") &&
        !/@inertiajs\/vite|wayfinder/i.test(plugin.name || "") &&
        !["dslinter", "useClassy"].includes(plugin.name),
    );
}

export async function createPreviewServer(
  app: PreviewApp,
  scanRoot: string,
): Promise<ViteDevServer> {
  const nuxt = isNuxtApp(app.root) ? await loadNuxtPreviewConfig(app.root) : undefined;
  const vite = await import(pathToFileURL(nuxt?.viteEntry ?? resolveVite(app.root)).href);
  const loaded = nuxt
    ? { config: nuxt.config }
    : await vite.loadConfigFromFile(
        { command: "serve", mode: "development" },
        app.config,
        app.root,
        "warn",
        undefined,
        "runner",
      );
  const config: UserConfig = loaded?.config || {};
  const styles = nuxt ? nuxt.styles : detectPreviewStyles(app, config);
  const adapter = findPreviewAdapter(app.root, scanRoot);
  const frameworkFile = resolve(packageRoot, "src/explorer", `${app.framework}Runtime.ts`);
  const runtimeFile = resolve(packageRoot, "src/explorer/runtime.ts");
  const shimFile = resolve(
    packageRoot,
    "src/explorer",
    app.framework === "vue" ? "inertiaVue.ts" : "inertiaReact.ts",
  );
  const host: Plugin = {
    name: "dslinter-preview-host",
    enforce: "pre",
    // Babel resolves configured plugins relative to cwd, even when Vite has a root.
    api: {
      reactBabel(options: Record<string, unknown>) {
        options.cwd = app.root;
      },
    },
    resolveId(id, importer) {
      if (id === "./providerRecovery" && importer === "\0dslinter-framework.ts")
        return resolve(packageRoot, "src/explorer/providerRecovery.ts");
      if (id === "./inertiaShared" && importer === "\0dslinter-inertia.ts")
        return resolve(packageRoot, "src/explorer/inertiaShared.ts");
      if (id === "virtual:dslinter/framework") return "\0dslinter-framework.ts";
      if (id === "virtual:dslinter/axe") return "\0dslinter-axe";
      if (id === "virtual:dslinter/adapter") return "\0dslinter-adapter";
      if (id === "virtual:dslinter/nuxt") return "\0dslinter-nuxt";
      if (id === "virtual:dslinter/frame-entry") return "\0dslinter-frame-entry";
      if (id === "/__dslinter/entry.js") return "\0dslinter-frame-entry";
      if (id === "virtual:dslinter/playground-modules") return "\0dslinter-legacy-modules";
      if (id === "@inertiajs/react" || id === "@inertiajs/vue3") return "\0dslinter-inertia.ts";
      if (id === "ziggy-js" || id === "ziggy")
        return resolve(packageRoot, "vite/shims/ziggy-js.ts");
    },
    async load(id) {
      if (id === "\0dslinter-axe") {
        // Serve the tool's browser bundle in this document, including in Vue-only installs.
        const toolRequire = createRequire(join(packageRoot, "package.json"));
        return (
          readFileSync(toolRequire.resolve("axe-core"), "utf8") + "\nexport default window.axe;"
        );
      }
      if (id === "\0dslinter-framework.ts" || id === "\0dslinter-inertia.ts") {
        const path = id === "\0dslinter-framework.ts" ? frameworkFile : shimFile;
        return transformWithEsbuild(readFileSync(path, "utf8"), path, {
          loader: "ts",
          target: "esnext",
          format: "esm",
        });
      }
      if (id === "\0dslinter-legacy-modules") return "export const scanPlaygroundModules = {};";
      if (id === "\0dslinter-nuxt" && nuxt)
        // A Nuxt app instance and the app's client plugins, so components can call
        // useNuxtApp, useState, useRuntimeConfig, NuxtLink and other Nuxt runtime APIs.
        return [
          'import { applyPlugins, createNuxtApp } from "#app/nuxt";',
          'import plugins from "#build/plugins";',
          `window.__NUXT__ ||= ${JSON.stringify({ serverRendered: false, config: nuxt.runtimeConfig })};`,
          "export async function setup(vueApp) {",
          "  const nuxtApp = createNuxtApp({ vueApp });",
          "  try {",
          "    await applyPlugins(nuxtApp, plugins);",
          '    await nuxtApp.hooks.callHook("app:created", vueApp);',
          "  } catch (error) {",
          '    console.warn("[dslinter] A Nuxt plugin failed while preparing the preview:", error);',
          "  }",
          "}",
        ].join("\n");
      if (id === "\0dslinter-adapter")
        return adapter
          ? `export { default } from ${JSON.stringify(adapter)};`
          : "export default {};";
      if (id === "\0dslinter-frame-entry")
        return [
          ...styles.map((style) => `import ${JSON.stringify(style)};`),
          ...(nuxt
            ? [
                'import { setup as setupNuxt } from "virtual:dslinter/nuxt";',
                "globalThis.__dslinterVueSetup = setupNuxt;",
              ]
            : []),
          `import { boot } from ${JSON.stringify(runtimeFile)};`,
          `boot(${JSON.stringify({ root: scanRoot, moduleRoot: config.root ? resolve(app.root, config.root) : app.root, app: app.id, framework: app.framework, styles, moduleLoader: true, adapterRoot: realpathSync(adapter ? dirname(adapter) : app.root) })});`,
        ].join("\n");
    },
    transform(code, id) {
      // The preview frame's document is cross-origin to its module server, so the browser
      // rejects history API calls; Nuxt's router gets memory history instead.
      if (nuxt && /[\\/]nuxt[\\/]dist[\\/]pages[\\/]runtime[\\/]plugins[\\/]router\.js/.test(id))
        return code.replace(
          "const history = routerOptions.history?.(routerBase) ??",
          "const history = createMemoryHistory(routerBase) ??",
        );
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/__dslinter/frame.html")) return next();
        const html = await server.transformIndexHtml(
          "/__dslinter/frame.html",
          '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="dslinter-preview"></div><script type="module">import "virtual:dslinter/frame-entry";</script></body></html>',
        );
        res.setHeader("Content-Type", "text/html");
        res.end(html);
      });
    },
  };
  const server = await createServer(vite, nuxt, {
    ...config,
    configFile: false,
    root: config.root ? resolve(app.root, config.root) : app.root,
    base: "/",
    publicDir: config.publicDir ?? (nuxt ? resolve(app.root, "public") : "public"),
    cacheDir: join(
      workspaceCacheDir(scanRoot),
      "node_modules/.vite/hosts",
      String(process.pid),
      Buffer.from(app.id).toString("hex"),
    ),
    plugins: [
      host,
      previewModuleLoader([scanRoot, app.root, packageRoot]),
      ...cachedUseClassy(
        join(workspaceCacheDir(scanRoot), "manifests", Buffer.from(app.id).toString("hex")),
        app.framework,
        packageRoot,
      ),
      ...previewSafePlugins(await Promise.all(config.plugins || [])),
    ],
    resolve: {
      ...config.resolve,
      alias: loadConsumerAliases(app.root, config.resolve?.alias),
      dedupe: ["react", "react-dom", "vue"],
    },
    optimizeDeps: {
      ...config.optimizeDeps,
      entries: [],
      include: [
        ...(config.optimizeDeps?.include || []),
        ...(json(join(app.root, "package.json")).dependencies?.["@laravel/passkeys"]
          ? ["@laravel/passkeys/react"]
          : []),
        ...Object.keys(json(join(app.root, "package.json")).dependencies || {}).filter((name) =>
          /^(?:@radix-ui\/react-|@headlessui\/react$|@base-ui\/react|@laravel\/passkeys$|reka-ui$|radix-vue$|input-otp$|lucide-react$|sonner$|class-variance-authority$|clsx$|tailwind-merge$)/.test(
            name,
          ),
        ),
        ...(app.framework === "vue"
          ? ["vue"]
          : [
              "react",
              "react-dom",
              "react-dom/client",
              "react/jsx-runtime",
              "react/jsx-dev-runtime",
              "react/compiler-runtime",
            ]),
      ],
      exclude: (config.optimizeDeps?.exclude || []).filter(
        (name) =>
          ![
            "vue",
            "react",
            "react-dom",
            "react-dom/client",
            "react/jsx-runtime",
            "react/jsx-dev-runtime",
            "react/compiler-runtime",
          ].includes(name),
      ),
    },
    server: {
      host: "127.0.0.1",
      port: 0,
      cors: true,
      open: false,
      fs: { allow: [scanRoot, app.root, packageRoot, workspaceCacheDir(scanRoot)] },
      watch: { ignored: ["**/.git/**", "**/vendor/**"] },
    },
  });
  await server.listen().catch(async (error: unknown) => {
    await server.close();
    throw error;
  });
  return server;
}

/** Create the Vite server; a Nuxt instance lives as long as it and closes with it. */
async function createServer(
  vite: typeof import("vite"),
  nuxt: { close: () => Promise<void> } | undefined,
  options: Parameters<typeof import("vite").createServer>[0],
): Promise<ViteDevServer> {
  let server: ViteDevServer;
  try {
    server = await vite.createServer(options);
  } catch (error) {
    await nuxt?.close();
    throw error;
  }
  if (nuxt) {
    const close = server.close.bind(server);
    server.close = async () => {
      await close();
      await nuxt.close();
    };
  }
  return server;
}

/** The app's own Vite, else the one bundled with DSLinter (apps that get Vite transitively). */
function resolveVite(appRoot: string): string {
  for (const root of [appRoot, packageRoot]) {
    try {
      return createRequire(join(root, "package.json")).resolve("vite");
    } catch {
      // try the next root
    }
  }
  throw new Error(`Cannot resolve "vite" from ${appRoot}`);
}
