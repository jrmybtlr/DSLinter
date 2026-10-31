import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { Plugin } from "vite";

const require = createRequire(import.meta.url);
const missing = "\0dslinter:react-grab-missing";

/** Dev-only React Grab. Missing installs resolve to an empty module so the dashboard still loads. */
export function reactGrab(): Plugin {
  return {
    name: "dslinter:react-grab",
    apply: "serve",
    config() {
      const entry = resolveReactGrab();
      if (!entry) return;
      return { server: { fs: { allow: [dirname(realpathSync(entry))] } } };
    },
    resolveId(id) {
      if (id !== "react-grab" || resolveReactGrab()) return null;
      return missing;
    },
    load(id) {
      if (id === missing) return "export {}";
    },
  };
}

function resolveReactGrab() {
  try {
    return require.resolve("react-grab");
  } catch {
    return undefined;
  }
}
