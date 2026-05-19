/**
 * Add to your existing `vite.config.ts` when using `npx dslinter` dev mode.
 * Adjust paths if your app layout differs from `src/` + `public/dslint-report.json`.
 */
import path from "node:path";

const DSLINT_SERVE_PORT = Number(process.env.DSLINT_SERVE_PORT ?? "7878");

// Inside defineConfig(({ mode }) => ({ ... })):
export const dslinterViteSnippet = {
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    proxy:
      // mode === "serve" when started via `npx dslinter` (not plain `vite`)
      {
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
