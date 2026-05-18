import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(packageRoot, "src");

export default defineConfig(({ mode }) => {
  const apiPort = Number(process.env.DSLINT_SERVE_PORT ?? "7878");

  return {
    root: packageRoot,
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        "@": srcDir,
      },
    },
    build: {
      outDir: "dashboard-dist",
      emptyOutDir: true,
    },
    server: {
      port: Number(process.env.DSLINTER_DEV_UI_PORT ?? "5175"),
      strictPort: true,
      proxy:
        mode === "serve"
          ? {
              "/dslint-report.json": {
                target: `http://127.0.0.1:${apiPort}`,
                changeOrigin: true,
              },
              "/events": {
                target: `http://127.0.0.1:${apiPort}`,
                changeOrigin: true,
              },
            }
          : undefined,
    },
  };
});
