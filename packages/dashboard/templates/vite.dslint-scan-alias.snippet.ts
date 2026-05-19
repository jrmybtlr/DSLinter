// Add to vite.config.ts when using @dslint-scan embed-style glob in App:
//
//   import path from "node:path";
//   const scanRoot = path.resolve(process.env.DSLINT_SCAN_ROOT ?? ".");
//
//   resolve: { alias: { "@dslint-scan": scanRoot } },
//   server: { fs: { allow: [scanRoot] } },
//
// App — glob every .tsx/.jsx under @dslint-scan (use ** recursive glob in import.meta.glob).
//   buildPlaygroundEntriesFromReport(report, modules);
//
// Prefer: npx dslinter init --laravel (relative glob) for Inertia resources/js layouts.

export {};
