import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardSrc = path.resolve(packageDir, "src");

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": dashboardSrc,
    },
  },
  build: {
    outDir: "dashboard-dist",
    emptyOutDir: true,
  },
});
