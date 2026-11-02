// Run: pnpm --filter dslinter exec vite --config tests/previewRecovery/vite.config.ts
// Open the printed URL. #results reports assertions against real browser roots and frames.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { previewModuleLoader } from "../../vite/previewModuleLoader";
import { defineConfig } from "vite";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = resolve(root, "dashboard/src/explorer");
export default defineConfig({
  root,
  cacheDir: "/tmp/dslinter-provider-browser-cache",
  optimizeDeps: { entries: ["dashboard/tests/previewRecovery/index.html"] },
  esbuild: { jsx: "automatic" },
  resolve: {
    dedupe: ["react", "react-dom", "vue"],
    alias: {
      react: resolve(root, "dashboard/node_modules/react"),
      "react-dom": resolve(root, "dashboard/node_modules/react-dom"),
      vue: resolve(root, "dashboard/node_modules/vue"),
      "@": resolve(root, "demo/inertia/resources/js"),
      "@inertiajs/react": resolve(source, "inertiaReact.ts"),
    },
  },
  plugins: [
    previewModuleLoader([root]),
    {
      name: "provider-test-harness",
      resolveId(id) {
        if (
          id === "virtual:dslinter/axe" ||
          id === "virtual:dslinter/adapter" ||
          id === "virtual:dslinter/framework" ||
          id === "virtual:dslinter/explorer"
        )
          return `\0${id}`;
      },
      load(id) {
        if (id === "\0virtual:dslinter/axe")
          return "export default {run: async () => ({violations: []})};";
        if (id === "\0virtual:dslinter/adapter")
          return `import { PageConsumer } from ${JSON.stringify(resolve(root, "dashboard/tests/previewRecovery/adapterCycleFixture.tsx"))};
          const app = new URLSearchParams(location.search).get("app");
          const configured = app?.endsWith("-configured");
          export default app === "react-cycle" ? { pageProps: { cycleValue: "Adapter page props loaded" }, previews: { "dashboard/tests/previewRecovery/adapterCycleFixture.tsx#PageConsumer": { PlaygroundPreview: PageConsumer } } } : configured ? { react: { wrap: (children) => children }, vue: { setup: () => {} } } : {};`;
        if (id === "\0virtual:dslinter/explorer")
          return `export default ${JSON.stringify({
            root,
            apps: [
              { id: "react", framework: "react" },
              { id: "react-legacy", framework: "react" },
              { id: "vue", framework: "vue" },
              { id: "react-configured", framework: "react" },
              { id: "react-cycle", framework: "react" },
              { id: "vue-configured", framework: "vue" },
            ],
          })};`;
        if (id === "\0virtual:dslinter/framework")
          return `export async function mount(...args) { const runtime = args[3].framework === "vue" ? await import(${JSON.stringify(resolve(source, "vueRuntime.ts"))}) : await import(${JSON.stringify(resolve(source, "reactRuntime.ts"))}); return runtime.mount(...args); }`;
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url || "/", "http://localhost");
          if (url.pathname === "/__tests/hot-provider") {
            const file = resolve(root, "demo/inertia/resources/js/components/ui/sidebar.tsx");
            const modules = server.moduleGraph.getModulesByFile(file);
            if (!modules?.size)
              throw new Error("Provider was not loaded before the HMR regression");
            for (const module of modules)
              server.moduleGraph.invalidateModule(module, new Set(), Date.now(), true);
            server.ws.send({ type: "update", updates: [] });
            res.end("ok");
            return;
          }
          if (url.pathname === "/__tests/invalidate") {
            server.ws.send({ type: "update", updates: [] });
            res.end("ok");
            return;
          }
          if (url.pathname !== "/__dslinter/frame") return next();
          const framework = url.searchParams.get("app")?.startsWith("vue") ? "vue" : "react";
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              url.pathname,
              `<!doctype html><div id="dslinter-preview"></div><script type="module">import { boot } from "/dashboard/src/explorer/runtime.ts"; boot(${JSON.stringify({ root, moduleRoot: url.searchParams.get("app") === "react-legacy" ? undefined : root, moduleLoader: url.searchParams.get("app") !== "react-legacy", app: framework, framework, styles: [], adapterRoot: root })});</script>`,
            ),
          );
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 5186,
    strictPort: true,
    open: "/dashboard/tests/previewRecovery/index.html",
  },
});
