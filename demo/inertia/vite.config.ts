import path from "node:path";
import { fileURLToPath } from "node:url";
import inertia from "@inertiajs/vite";
import { wayfinder } from "@laravel/vite-plugin-wayfinder";
import tailwindcss from "@tailwindcss/vite";
import dslinter from "dslinter/vite";
import useClassy from "dslinter/useclassy";
import react from "@vitejs/plugin-react";
import laravel from "laravel-vite-plugin";
import { bunny } from "laravel-vite-plugin/fonts";
import { defineConfig } from "vite";

const demoDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardPkg = path.resolve(demoDir, "../../dashboard");
const dashboardSrc = path.join(dashboardPkg, "src");
const DSLINTER_SERVE_PORT = 7878;

export default defineConfig(({ mode }) => ({
  plugins: [
    useClassy({ language: "react" }),
    laravel({
      input: ["resources/css/app.css", "resources/js/app.tsx"],
      refresh: true,
      fonts: [
        bunny("Instrument Sans", {
          weights: [400, 500, 600],
        }),
      ],
    }),
    inertia(),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
    wayfinder({
      formVariants: true,
    }),
    dslinter({ scanRoot: demoDir, consumerViteRoot: demoDir }),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: [
      {
        find: "dslinter/theme.css",
        replacement: path.join(dashboardSrc, "styles/dashboard-theme.css"),
      },
      {
        find: /^dslinter$/,
        replacement: path.join(dashboardSrc, "index.ts"),
      },
    ],
  },
  optimizeDeps: {
    exclude: ["dslinter"],
  },
  server: {
    proxy:
      mode === "serve"
        ? {
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
