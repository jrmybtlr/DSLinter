/**
 * Legacy snippet — prefer `import dslinter from "dslinter/vite"` (one plugin line).
 * `npx dslinter` merges the plugin automatically when a consumer Vite app exists.
 */
function resolveServePort(): number {
  const rawPort = process.env.DSLINTER_SERVE_PORT ?? process.env.PORT;
  const parsedPort = Number(rawPort);

  if (Number.isInteger(parsedPort) && parsedPort > 0) {
    return parsedPort;
  }

  return 3210;
}

const DSLINTER_SERVE_PORT = resolveServePort();

export const dslinterViteSnippet = {
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    exclude: ["dslinter"],
  },
  server: {
    proxy: {
      "/dslinter-report.json": {
        target: `http://127.0.0.1:${DSLINTER_SERVE_PORT}`,
        changeOrigin: true,
      },
      "/events": {
        target: `http://127.0.0.1:${DSLINTER_SERVE_PORT}`,
        changeOrigin: true,
      },
    },
  },
};
