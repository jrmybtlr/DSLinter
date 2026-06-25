import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import dslinter from "dslinter/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DSLINTER_SERVE_PORT = 7878;
const demoDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardPkg = path.resolve(demoDir, "../../packages/dashboard");
const dashboardSrc = path.join(dashboardPkg, "src");
/** One React instance for demo + linked dashboard (avoids invalid hook call). */
const reactRoot = path.resolve(demoDir, "node_modules/react");
const reactDomRoot = path.resolve(demoDir, "node_modules/react-dom");
const useSyncExternalStoreShim = path.resolve(
  demoDir,
  "src/shims/use-sync-external-store-shim.ts",
);

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), react(), dslinter({ scanRoot: demoDir })],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      /** Live workspace source — avoids stale pnpm store copies when new modules are added. */
      {
        find: "dslinter/theme.css",
        replacement: path.join(dashboardSrc, "styles/dashboard-theme.css"),
      },
      { find: /^dslinter$/, replacement: path.join(dashboardSrc, "index.ts") },
      { find: "react", replacement: reactRoot },
      { find: "react-dom", replacement: reactDomRoot },
      {
        find: "use-sync-external-store/shim",
        replacement: useSyncExternalStoreShim,
      },
    ],
  },
  optimizeDeps: {
    /**
     * Pre-bundle Radix hook so it pulls `use-sync-external-store/shim` through our alias (ESM re-export from `react`).
     */
    include: ["react", "react-dom", "@radix-ui/react-use-is-hydrated"],
    /** Linked workspace package: transpile from source so edits hot-reload like npm would after publish. */
    exclude: ["dslinter"],
  },
  server: {
    proxy:
      mode === "serve"
        ? {
            // Proxy the JSON report and SSE stream from the Rust server so
            // the browser doesn't hit CORS when using `npm run dev:serve`.
            "/dslinter-report.json": {
              target: `http://127.0.0.1:${DSLINTER_SERVE_PORT}`,
              changeOrigin: true,
            },
            "/events": {
              target: `http://127.0.0.1:${DSLINTER_SERVE_PORT}`,
              changeOrigin: true,
            },
          }
        : undefined,
  },
}));
