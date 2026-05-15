/**
 * Radix (and others) import `use-sync-external-store/shim`, which is CJS-only.
 * Vite can surface `@fs/.../shim/index.js` without correct interop, breaking named ESM imports.
 * React 18+ provides the native hook — re-export it here for a stable ESM path.
 */
export { useSyncExternalStore } from "react";
