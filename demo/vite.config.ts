import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    /** Linked workspace package: transpile from source so edits hot-reload like npm would after publish. */
    exclude: ["@dslint/workbench"],
  },
});
