import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dslinter from "./vite/plugin";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultScanRoot = path.resolve(packageRoot, "../../demo");
const scanRoot = process.env.DSLINTER_SCAN_ROOT
  ? path.resolve(process.env.DSLINTER_SCAN_ROOT)
  : defaultScanRoot;
const consumerViteRoot = process.env.DSLINTER_CONSUMER_VITE_ROOT?.trim()
  ? path.resolve(process.env.DSLINTER_CONSUMER_VITE_ROOT)
  : undefined;

export default defineConfig(() => ({
  root: packageRoot,
  plugins: [
    tailwindcss(),
    react(),
    dslinter({ scanRoot, consumerViteRoot }),
  ],
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
