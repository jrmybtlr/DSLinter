import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dslinter from "./vite/plugin";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(packageRoot, "src");
const defaultScanRoot = path.resolve(packageRoot, "../../demo");
const scanRoot = process.env.DSLINT_SCAN_ROOT
  ? path.resolve(process.env.DSLINT_SCAN_ROOT)
  : defaultScanRoot;

export default defineConfig(() => ({
  root: packageRoot,
  plugins: [
    tailwindcss(),
    react(),
    dslinter({ scanRoot }),
  ],
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
    fs: {
      allow: [packageRoot, scanRoot],
    },
    port: Number(process.env.DSLINTER_DEV_UI_PORT ?? "5175"),
    strictPort: true,
  },
}));
