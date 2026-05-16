import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DSLINT_SERVE_PORT = 7878;
const demoDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardSrc = path.resolve(demoDir, "../packages/dashboard/src");
/** One React instance for demo + linked dashboard (avoids invalid hook call). */
const reactRoot = path.resolve(demoDir, "node_modules/react");
const reactDomRoot = path.resolve(demoDir, "node_modules/react-dom");
const useSyncExternalStoreShim = path.resolve(
  demoDir,
  "src/shims/use-sync-external-store-shim.ts",
);

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      /** Matches dashboard `components.json` / shadcn `@/*` imports and `import.meta.glob("@/…")`. */
      "@": dashboardSrc,
      react: reactRoot,
      "react-dom": reactDomRoot,
      /** ESM re-export from `react` — avoids CJS `use-sync-external-store/shim` under `@fs`. */
      "use-sync-external-store/shim": useSyncExternalStoreShim,
    },
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
            "/dslint-report.json": {
              target: `http://127.0.0.1:${DSLINT_SERVE_PORT}`,
              changeOrigin: true,
            },
            "/events": {
              target: `http://127.0.0.1:${DSLINT_SERVE_PORT}`,
              changeOrigin: true,
            },
          }
        : undefined,
  },
}));
