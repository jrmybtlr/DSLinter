import { mkdtempSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { detectPreviewStyles, previewSafePlugins } from "./previewHost";
import { cachedUseClassy } from "./cachedUseClassy";

it("detects shadcn CSS without creating configuration", () => {
  const root = mkdtempSync(join(tmpdir(), "dslinter-styles-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/app.css"), "body { color: blue }");
  writeFileSync(
    join(root, "components.json"),
    JSON.stringify({ tailwind: { css: "src/app.css" } }),
  );
  const app = { id: ".", name: "test", root, config: "", framework: "vue" as const };
  const before = readdirSync(root, { recursive: true });
  expect(detectPreviewStyles(app)).toEqual([join(root, "src/app.css")]);
  expect(readdirSync(root, { recursive: true })).toEqual(before);
});

it("keeps transforms while removing backend and manifest-writing host integrations", () => {
  expect(
    previewSafePlugins([
      { name: "laravel" },
      [{ name: "inertia" }, { name: "@inertiajs/vite" }, { name: "laravel-vite-plugin-wayfinder" }],
      { name: "useClassy" },
      { name: "vite:vue" },
      { name: "vite:css" },
    ]).map((plugin) => plugin.name),
  ).toEqual(["vite:vue", "vite:css"]);
});

it("keeps UseClassy config and output entirely outside the app", async () => {
  const root = mkdtempSync(join(tmpdir(), "dslinter-no-writes-"));
  const cache = mkdtempSync(join(tmpdir(), "dslinter-classy-cache-"));
  const before = readdirSync(root);
  const plugins = cachedUseClassy(cache, "react") as any[];
  const plugin = plugins[1];
  plugin.configResolved({ root, command: "serve", build: {} });
  expect(readdirSync(root)).toEqual(before);
  expect(readdirSync(cache)).toContain(".gitignore");
});

it("transforms published dashboard sources inside node_modules", () => {
  const root = mkdtempSync(join(tmpdir(), "dslinter-installed-"));
  const cache = mkdtempSync(join(tmpdir(), "dslinter-installed-cache-"));
  const sourceRoot = join(root, "node_modules/dslinter");
  const plugin = cachedUseClassy(cache, "react", sourceRoot)[1] as any;
  plugin.configResolved({ root: sourceRoot, command: "serve", build: {} });
  const watched: string[] = [];
  const result = plugin.transform.call(
    {
      addWatchFile(path: string) {
        watched.push(path);
      },
    },
    '<button className="base" className:hover="text-red-500" />',
    join(sourceRoot, "src/Button.tsx"),
  );
  expect(result.code).toContain("hover:text-red-500");
  expect(result.code).not.toContain("className:hover");
  expect(watched).toEqual([join(sourceRoot, "src/Button.tsx")]);
});
