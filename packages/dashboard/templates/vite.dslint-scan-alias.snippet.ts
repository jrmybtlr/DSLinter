/**
 * Add to `vite.config.ts` when using the `@dslint-scan` embed-style glob in your App:
 *
 *   import path from "node:path";
 *   const scanRoot = path.resolve(process.env.DSLINT_SCAN_ROOT ?? ".");
 *
 *   resolve: {
 *     alias: {
 *       "@dslint-scan": scanRoot,
 *     },
 *   },
 *   server: {
 *     fs: { allow: [scanRoot] },
 *   },
 *
 * App:
 *   const modules = import.meta.glob("@dslint-scan/**/*.{tsx,jsx}", { eager: true });
 *   buildPlaygroundEntriesFromReport(report, modules);
 *
 * Prefer `npx dslinter init --laravel` (relative glob) when you have your own Vite app.
 */
