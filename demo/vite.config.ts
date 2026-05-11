import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DSLINT_SERVE_PORT = 7878;

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), react()],
  optimizeDeps: {
    /** Linked workspace package: transpile from source so edits hot-reload like npm would after publish. */
    exclude: ["@dslint/workbench"],
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
