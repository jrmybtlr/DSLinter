import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { detectInitLayout } from "./scaffold-config.mjs";
import { envIs } from "./env.mjs";

const HOST_APP_CANDIDATES = [
  "src/App.tsx",
  "src/App.jsx",
  "src/app.tsx",
  "resources/js/app.tsx",
];

/**
 * True when the scan root already embeds DashboardLayout (e.g. demo app).
 * @param {string} scanRoot
 */
export function scanProjectHostsDashboard(scanRoot) {
  const root = resolve(scanRoot);
  for (const rel of HOST_APP_CANDIDATES) {
    const p = join(root, rel);
    if (!existsSync(p)) continue;
    try {
      const text = readFileSync(p, "utf8");
      if (/DashboardLayout/.test(text) && /dslinter/.test(text)) {
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Prefer consumer Vite dev (host app) vs embed dashboard SPA.
 * @param {string} scanRoot
 */
export function shouldUseConsumerViteDev(scanRoot) {
  if (envIs("USE_CONSUMER_VITE")) return true;
  if (envIs("NO_CONSUMER_VITE")) return false;
  if (scanProjectHostsDashboard(scanRoot)) return true;
  if (detectInitLayout(scanRoot) === "laravel") return false;
  return false;
}
