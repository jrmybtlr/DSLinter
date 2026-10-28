import { mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { PluginOption } from "vite";
import useClassy from "vite-plugin-useclassy";

/** UseClassy's manifestRoot also controls .gitignore writes, not just its output file. */
export function cachedUseClassy(
  cache: string,
  language: "react" | "vue",
  sourceRoot?: string,
): PluginOption[] {
  mkdirSync(cache, { recursive: true });
  const manifest = join(cache, "classy/output.classy.html").replaceAll("\\", "/");
  const plugin = useClassy({ language, manifestRoot: cache, outputDir: "classy" });
  const transform =
    typeof plugin.transform === "function" ? plugin.transform : plugin.transform?.handler;
  // Published source lives in node_modules, which UseClassy normally excludes.
  if (transform)
    plugin.transform = function (source, id, options) {
      const ownSource =
        sourceRoot && id.startsWith(sourceRoot + "/") && id.includes("/node_modules/");
      const transformId = ownSource ? `/__dslinter_source/${relative(sourceRoot, id)}` : id;
      const context = Object.create(this);
      context.addWatchFile = (path: string) => this.addWatchFile(path === transformId ? id : path);
      return transform.call(context, source, transformId, options);
    };
  return [
    {
      name: "dslinter-cached-classy-source",
      enforce: "pre",
      transform(source, id) {
        if (!id.split("?")[0].endsWith(".css")) return;
        return source.replace(
          /@source\s+["'][^"']*\.classy\/output\.classy\.html["'];?/g,
          `@source ${JSON.stringify(manifest)};`,
        );
      },
    },
    plugin,
  ];
}
