import { realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { Plugin } from "vite";

const route = "/__dslinter/module.js?";
const prefix = "\0dslinter-module:";

/** Let Vite own the import URL, including canonical paths and HMR timestamps. */
export function previewModuleLoader(roots: string[]): Plugin {
  function request(id: string): URLSearchParams {
    return new URLSearchParams(id.slice(prefix.length));
  }
  function localPath(path: string | null): string {
    if (!path || !isAbsolute(path))
      throw new Error("Preview imports require an absolute source path");
    const file = realpathSync(path);
    if (
      !roots.some((root) => {
        const tail = relative(realpathSync(root), file);
        return tail === "" || (!tail.startsWith("..") && !isAbsolute(tail));
      })
    )
      throw new Error("Preview import is outside the allowed source roots");
    return file;
  }
  return {
    name: "dslinter-module-loader",
    enforce: "pre",
    async resolveId(id, importer) {
      if (id.startsWith(route)) return prefix + id.slice(route.length);
      if (importer?.startsWith(prefix)) {
        const params = request(importer);
        return this.resolve(id, localPath(params.get("from") || params.get("path")), {
          skipSelf: true,
        });
      }
    },
    load(id) {
      if (!id.startsWith(prefix)) return;
      const params = request(id);
      const from = localPath(params.get("from") || params.get("path"));
      const specifier = params.get("specifier");
      if (specifier && /^(?:https?:|data:|file:)/.test(specifier))
        throw new Error("Unsupported preview import protocol");
      this.addWatchFile(from);
      return `import * as namespace from ${JSON.stringify(specifier || resolve(from).replaceAll("\\", "/"))};\nexport default namespace;`;
    },
  };
}
