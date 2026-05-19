/**
 * Merge into your existing `vite.config.ts` when using `npx dslinter` dev mode.
 *
 * Published dslinter source uses relative imports only — your app's `@/*` alias
 * (e.g. Laravel `@/*` → `resources/js/*`) does not need remapping for package UI.
 *
 * Adjust proxy paths if your report is not served from the Vite dev server root.
 */
const DSLINT_SERVE_PORT = Number(process.env.DSLINT_SERVE_PORT ?? "7878");

// Inside defineConfig(({ mode }) => ({ ... })):
export const dslinterViteSnippet = {
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    /** Source-first package: transpile from node_modules instead of pre-bundling. */
    exclude: ["dslinter"],
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
