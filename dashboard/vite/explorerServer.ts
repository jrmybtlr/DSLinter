import { readFileSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { cachedUseClassy } from "./cachedUseClassy";
import { createPreviewServer, type PreviewApp } from "./previewHost";
import { openFileInEditor } from "./openFileInEditor.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scanRoot = process.env.DSLINTER_SCAN_ROOT!;
const cache = process.env.DSLINTER_CACHE_PATH!;
const apps: PreviewApp[] = JSON.parse(process.env.DSLINTER_APPS || "[]");
const previews = new Map<string, Promise<ViteDevServer>>();
const plugin: Plugin = {
  name: "dslinter-explorer",
  resolveId(id) {
    if (id === "virtual:dslinter/explorer") return "\0dslinter-explorer";
    if (id === "virtual:dslinter/playground-modules") return "\0dslinter-legacy-modules";
  },
  load(id) {
    if (id === "\0dslinter-legacy-modules") return "export const scanPlaygroundModules = {};";
    if (id === "\0dslinter-explorer")
      return `export default ${JSON.stringify({ apps, selectedApp: process.env.DSLINTER_SELECTED_APP, root: scanRoot })};`;
  },
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname === "/dslinter-report.json") {
        try {
          const path = process.env.DSLINTER_REPORT_PATH!;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("ETag", `"${statSync(path).mtimeMs}"`);
          res.end(req.method === "HEAD" ? undefined : readFileSync(path));
        } catch {
          res.statusCode = 503;
          res.end("Scan not ready");
        }
        return;
      }
      if (url.pathname === "/dslinter/open-file" && req.method === "POST") {
        try {
          openFileInEditor({
            file: url.searchParams.get("path"),
            line: Number(url.searchParams.get("line") || 1),
            column: 1,
            scanRoot,
          });
          res.end("{}");
        } catch (error) {
          res.statusCode = 400;
          res.end(String(error));
        }
        return;
      }
      if (url.pathname !== "/__dslinter/frame") return next();
      const app = apps.find((app) => app.id === url.searchParams.get("app"));
      if (!app) {
        res.statusCode = 404;
        res.end("No preview application selected");
        return;
      }
      try {
        let pending = previews.get(app.id);
        if (!pending) {
          const reportRoot = JSON.parse(
            readFileSync(process.env.DSLINTER_REPORT_PATH!, "utf8"),
          ).root;
          pending = createPreviewServer(app, reportRoot);
          previews.set(app.id, pending);
        }
        const preview = await pending;
        const origin = preview.resolvedUrls?.local[0];
        if (!origin) throw new Error("Preview server has no listening address");
        const html = await preview.transformIndexHtml(
          "/__dslinter/frame.html",
          `<!doctype html><html><head><base href="${origin}"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="dslinter-preview"></div><script type="module">import ${JSON.stringify(`${origin}__dslinter/entry.js`)};</script></body></html>`,
        );
        res.setHeader("Content-Type", "text/html");
        res.end(html.replace(/(["'])\/(?!\/)/g, `$1${origin}`));
      } catch (error) {
        previews.delete(app.id);
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain");
        res.end(`Preview host failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  },
};
const shell = await createServer({
  configFile: false,
  root: packageRoot,
  cacheDir: join(cache, "node_modules/.vite/shell"),
  plugins: [
    plugin,
    ...cachedUseClassy(join(cache, "manifests/shell"), "react", packageRoot),
    tailwind(),
    react(),
  ],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.DSLINTER_DEV_UI_PORT),
    strictPort: true,
    fs: { allow: [packageRoot, cache] },
    proxy: { "/events": `http://127.0.0.1:${process.env.DSLINTER_SERVE_PORT}` },
  },
});
await shell.listen();
process.send?.({ type: "ready" });
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"])
  process.once(signal, async () => {
    await Promise.allSettled(
      [...previews.values()].map(async (pending) => (await pending).close()),
    );
    await shell.close();
    process.exit(0);
  });
