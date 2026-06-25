import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "vite/**/*.test.ts",
      "vite/**/*.test.mjs",
      "bin/**/*.test.mjs",
    ],
  },
});
