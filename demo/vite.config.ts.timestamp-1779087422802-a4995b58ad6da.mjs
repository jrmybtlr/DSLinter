// vite.config.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "file:///Users/jeremy/Development/DSLint/node_modules/.pnpm/@tailwindcss+vite@4.3.0_vite@5.4.21_@types+node@25.7.0_lightningcss@1.32.0_/node_modules/@tailwindcss/vite/dist/index.mjs";
import { defineConfig } from "file:///Users/jeremy/Development/DSLint/node_modules/.pnpm/vite@5.4.21_@types+node@25.7.0_lightningcss@1.32.0/node_modules/vite/dist/node/index.js";
import react from "file:///Users/jeremy/Development/DSLint/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@25.7.0_lightningcss@1.32.0_/node_modules/@vitejs/plugin-react/dist/index.js";
var __vite_injected_original_import_meta_url = "file:///Users/jeremy/Development/DSLint/demo/vite.config.ts";
var DSLINT_SERVE_PORT = 7878;
var demoDir = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var dashboardSrc = path.resolve(demoDir, "../packages/dashboard/src");
var reactRoot = path.resolve(demoDir, "node_modules/react");
var reactDomRoot = path.resolve(demoDir, "node_modules/react-dom");
var useSyncExternalStoreShim = path.resolve(
  demoDir,
  "src/shims/use-sync-external-store-shim.ts"
);
var vite_config_default = defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      /** Matches dashboard `components.json` / shadcn `@/*` imports from linked package source. */
      "@": dashboardSrc,
      react: reactRoot,
      "react-dom": reactDomRoot,
      /** ESM re-export from `react` — avoids CJS `use-sync-external-store/shim` under `@fs`. */
      "use-sync-external-store/shim": useSyncExternalStoreShim
    }
  },
  optimizeDeps: {
    /**
     * Pre-bundle Radix hook so it pulls `use-sync-external-store/shim` through our alias (ESM re-export from `react`).
     */
    include: ["react", "react-dom", "@radix-ui/react-use-is-hydrated"],
    /** Linked workspace package: transpile from source so edits hot-reload like npm would after publish. */
    exclude: ["dslinter"]
  },
  server: {
    proxy: mode === "serve" ? {
      // Proxy the JSON report and SSE stream from the Rust server so
      // the browser doesn't hit CORS when using `npm run dev:serve`.
      "/dslint-report.json": {
        target: `http://127.0.0.1:${DSLINT_SERVE_PORT}`,
        changeOrigin: true
      },
      "/events": {
        target: `http://127.0.0.1:${DSLINT_SERVE_PORT}`,
        changeOrigin: true
      }
    } : void 0
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvamVyZW15L0RldmVsb3BtZW50L0RTTGludC9kZW1vXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvamVyZW15L0RldmVsb3BtZW50L0RTTGludC9kZW1vL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9qZXJlbXkvRGV2ZWxvcG1lbnQvRFNMaW50L2RlbW8vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcGF0aCBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuXG5jb25zdCBEU0xJTlRfU0VSVkVfUE9SVCA9IDc4Nzg7XG5jb25zdCBkZW1vRGlyID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSk7XG5jb25zdCBkYXNoYm9hcmRTcmMgPSBwYXRoLnJlc29sdmUoZGVtb0RpciwgXCIuLi9wYWNrYWdlcy9kYXNoYm9hcmQvc3JjXCIpO1xuLyoqIE9uZSBSZWFjdCBpbnN0YW5jZSBmb3IgZGVtbyArIGxpbmtlZCBkYXNoYm9hcmQgKGF2b2lkcyBpbnZhbGlkIGhvb2sgY2FsbCkuICovXG5jb25zdCByZWFjdFJvb3QgPSBwYXRoLnJlc29sdmUoZGVtb0RpciwgXCJub2RlX21vZHVsZXMvcmVhY3RcIik7XG5jb25zdCByZWFjdERvbVJvb3QgPSBwYXRoLnJlc29sdmUoZGVtb0RpciwgXCJub2RlX21vZHVsZXMvcmVhY3QtZG9tXCIpO1xuY29uc3QgdXNlU3luY0V4dGVybmFsU3RvcmVTaGltID0gcGF0aC5yZXNvbHZlKFxuICBkZW1vRGlyLFxuICBcInNyYy9zaGltcy91c2Utc3luYy1leHRlcm5hbC1zdG9yZS1zaGltLnRzXCIsXG4pO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBwbHVnaW5zOiBbdGFpbHdpbmRjc3MoKSwgcmVhY3QoKV0sXG4gIHJlc29sdmU6IHtcbiAgICBkZWR1cGU6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCJdLFxuICAgIGFsaWFzOiB7XG4gICAgICAvKiogTWF0Y2hlcyBkYXNoYm9hcmQgYGNvbXBvbmVudHMuanNvbmAgLyBzaGFkY24gYEAvKmAgaW1wb3J0cyBmcm9tIGxpbmtlZCBwYWNrYWdlIHNvdXJjZS4gKi9cbiAgICAgIFwiQFwiOiBkYXNoYm9hcmRTcmMsXG4gICAgICByZWFjdDogcmVhY3RSb290LFxuICAgICAgXCJyZWFjdC1kb21cIjogcmVhY3REb21Sb290LFxuICAgICAgLyoqIEVTTSByZS1leHBvcnQgZnJvbSBgcmVhY3RgIFx1MjAxNCBhdm9pZHMgQ0pTIGB1c2Utc3luYy1leHRlcm5hbC1zdG9yZS9zaGltYCB1bmRlciBgQGZzYC4gKi9cbiAgICAgIFwidXNlLXN5bmMtZXh0ZXJuYWwtc3RvcmUvc2hpbVwiOiB1c2VTeW5jRXh0ZXJuYWxTdG9yZVNoaW0sXG4gICAgfSxcbiAgfSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgLyoqXG4gICAgICogUHJlLWJ1bmRsZSBSYWRpeCBob29rIHNvIGl0IHB1bGxzIGB1c2Utc3luYy1leHRlcm5hbC1zdG9yZS9zaGltYCB0aHJvdWdoIG91ciBhbGlhcyAoRVNNIHJlLWV4cG9ydCBmcm9tIGByZWFjdGApLlxuICAgICAqL1xuICAgIGluY2x1ZGU6IFtcInJlYWN0XCIsIFwicmVhY3QtZG9tXCIsIFwiQHJhZGl4LXVpL3JlYWN0LXVzZS1pcy1oeWRyYXRlZFwiXSxcbiAgICAvKiogTGlua2VkIHdvcmtzcGFjZSBwYWNrYWdlOiB0cmFuc3BpbGUgZnJvbSBzb3VyY2Ugc28gZWRpdHMgaG90LXJlbG9hZCBsaWtlIG5wbSB3b3VsZCBhZnRlciBwdWJsaXNoLiAqL1xuICAgIGV4Y2x1ZGU6IFtcImRzbGludGVyXCJdLFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBwcm94eTpcbiAgICAgIG1vZGUgPT09IFwic2VydmVcIlxuICAgICAgICA/IHtcbiAgICAgICAgICAgIC8vIFByb3h5IHRoZSBKU09OIHJlcG9ydCBhbmQgU1NFIHN0cmVhbSBmcm9tIHRoZSBSdXN0IHNlcnZlciBzb1xuICAgICAgICAgICAgLy8gdGhlIGJyb3dzZXIgZG9lc24ndCBoaXQgQ09SUyB3aGVuIHVzaW5nIGBucG0gcnVuIGRldjpzZXJ2ZWAuXG4gICAgICAgICAgICBcIi9kc2xpbnQtcmVwb3J0Lmpzb25cIjoge1xuICAgICAgICAgICAgICB0YXJnZXQ6IGBodHRwOi8vMTI3LjAuMC4xOiR7RFNMSU5UX1NFUlZFX1BPUlR9YCxcbiAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFwiL2V2ZW50c1wiOiB7XG4gICAgICAgICAgICAgIHRhcmdldDogYGh0dHA6Ly8xMjcuMC4wLjE6JHtEU0xJTlRfU0VSVkVfUE9SVH1gLFxuICAgICAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH1cbiAgICAgICAgOiB1bmRlZmluZWQsXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlTLE9BQU8sVUFBVTtBQUNsVCxTQUFTLHFCQUFxQjtBQUM5QixPQUFPLGlCQUFpQjtBQUN4QixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFdBQVc7QUFKZ0ssSUFBTSwyQ0FBMkM7QUFNbk8sSUFBTSxvQkFBb0I7QUFDMUIsSUFBTSxVQUFVLEtBQUssUUFBUSxjQUFjLHdDQUFlLENBQUM7QUFDM0QsSUFBTSxlQUFlLEtBQUssUUFBUSxTQUFTLDJCQUEyQjtBQUV0RSxJQUFNLFlBQVksS0FBSyxRQUFRLFNBQVMsb0JBQW9CO0FBQzVELElBQU0sZUFBZSxLQUFLLFFBQVEsU0FBUyx3QkFBd0I7QUFDbkUsSUFBTSwyQkFBMkIsS0FBSztBQUFBLEVBQ3BDO0FBQUEsRUFDQTtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxTQUFTLENBQUMsWUFBWSxHQUFHLE1BQU0sQ0FBQztBQUFBLEVBQ2hDLFNBQVM7QUFBQSxJQUNQLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFBQSxJQUM3QixPQUFPO0FBQUE7QUFBQSxNQUVMLEtBQUs7QUFBQSxNQUNMLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQTtBQUFBLE1BRWIsZ0NBQWdDO0FBQUEsSUFDbEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFJWixTQUFTLENBQUMsU0FBUyxhQUFhLGlDQUFpQztBQUFBO0FBQUEsSUFFakUsU0FBUyxDQUFDLFVBQVU7QUFBQSxFQUN0QjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sT0FDRSxTQUFTLFVBQ0w7QUFBQTtBQUFBO0FBQUEsTUFHRSx1QkFBdUI7QUFBQSxRQUNyQixRQUFRLG9CQUFvQixpQkFBaUI7QUFBQSxRQUM3QyxjQUFjO0FBQUEsTUFDaEI7QUFBQSxNQUNBLFdBQVc7QUFBQSxRQUNULFFBQVEsb0JBQW9CLGlCQUFpQjtBQUFBLFFBQzdDLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0YsSUFDQTtBQUFBLEVBQ1I7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
