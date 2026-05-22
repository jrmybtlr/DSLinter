/**
 * Legacy snippet — prefer `import dslinter from "dslinter/vite"` (one plugin line).
 * `npx dslinter` merges the plugin automatically when a consumer Vite app exists.
 */
import { resolveServePort } from "../../shared/servePort";

const DSLINT_SERVE_PORT = resolveServePort();

export const dslinterViteSnippet = {
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    exclude: ["dslinter"],
  },
  server: {
    proxy: {
      "/dslint-report.json": {
        target: `http://127.0.0.1:${DSLINT_SERVE_PORT}`,
        changeOrigin: true,
      },
      "/events": {
        target: `http://127.0.0.1:${DSLINT_SERVE_PORT}`,
        changeOrigin: true,
      },
    },
  },
};
