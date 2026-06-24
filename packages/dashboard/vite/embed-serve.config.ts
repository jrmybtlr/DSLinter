import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dslinter from "./plugin";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(configDir, "..");
const defaultScanRoot = path.resolve(packageRoot, "../../demo");
const scanRoot = process.env.DSLINTER_SCAN_ROOT
  ? path.resolve(process.env.DSLINTER_SCAN_ROOT)
  : defaultScanRoot;
const consumerViteRoot = process.env.DSLINTER_CONSUMER_VITE_ROOT?.trim()
  ? path.resolve(process.env.DSLINTER_CONSUMER_VITE_ROOT)
  : undefined;

/**
 * Resolve Vite and plugins from the consumer app (Laravel, etc.) when the
 * published package's devDependencies are not installed.
 */
function resolvePeer<T>(spec: string): T {
  const candidates = [consumerViteRoot, packageRoot].filter(
    (root): root is string => Boolean(root),
  );
  for (const root of candidates) {
    try {
      const req = createRequire(path.join(root, "package.json"));
      return req(spec) as T;
    } catch {
      // try next root
    }
  }
  throw new Error(
    `dslinter: cannot resolve "${spec}" — install it in your project or upgrade dslinter`,
  );
}

const { defineConfig } = resolvePeer<typeof import("vite")>("vite");
const tailwindcss =
  resolvePeer<typeof import("@tailwindcss/vite")>("@tailwindcss/vite").default;
const react =
  resolvePeer<typeof import("@vitejs/plugin-react")>("@vitejs/plugin-react")
    .default;

/** Published embed dev server config (`npx dslinter` on npm installs). */
export default defineConfig(() => ({
  root: packageRoot,
  plugins: [
    tailwindcss(),
    react(),
    dslinter({ scanRoot, consumerViteRoot }),
  ],
  server: {
    fs: {
      allow: [packageRoot, scanRoot],
    },
    port: Number(process.env.DSLINTER_DEV_UI_PORT ?? "5175"),
    strictPort: true,
  },
}));
