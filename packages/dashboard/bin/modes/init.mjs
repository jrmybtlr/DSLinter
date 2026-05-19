import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {string} targetDir
 * @returns {"laravel" | "default"}
 */
function detectInitLayout(targetDir) {
  if (existsSync(join(targetDir, "resources", "js"))) return "laravel";
  return "default";
}

/**
 * @param {{ targetDir?: string; layout?: "laravel" | "default"; argv?: string[] }} opts
 */
export function runInitMode(opts = {}) {
  const argv = opts.argv ?? [];
  const forceLaravel = argv.includes("--laravel") || argv.includes("--resources-js");
  const targetDir = resolve(
    opts.targetDir ?? argv.find((a) => !a.startsWith("-")) ?? process.cwd(),
  );
  const layout =
    opts.layout ?? (forceLaravel ? "laravel" : detectInitLayout(targetDir));

  const registryDir =
    layout === "laravel"
      ? join(targetDir, "resources", "js", "playground")
      : join(targetDir, "src", "playground");
  const registryPath = join(registryDir, "buildRegistry.ts");
  const templateName =
    layout === "laravel" ? "buildRegistry.laravel.ts" : "buildRegistry.ts";
  const templatePath = join(
    packageRoot,
    "templates",
    "playground",
    templateName,
  );

  if (existsSync(registryPath)) {
    process.stderr.write(
      `dslinter init: ${registryPath} already exists — remove it first to re-scaffold.\n`,
    );
    process.exit(1);
  }

  mkdirSync(registryDir, { recursive: true });
  copyFileSync(templatePath, registryPath);

  const snippetPath = join(registryDir, "vite.dslinter.snippet.ts");
  const snippetTemplate = join(
    packageRoot,
    "templates",
    "vite.dslinter.snippet.ts",
  );
  if (!existsSync(snippetPath) && existsSync(snippetTemplate)) {
    copyFileSync(snippetTemplate, snippetPath);
  }

  const appHintPath = join(registryDir, "README.txt");
  writeFileSync(
    appHintPath,
    [
      "Wire live component previews in your App:",
      "",
      "  import { useMemo } from 'react';",
      "  import { DashboardLayout, useWorkspaceReport } from 'dslinter';",
      layout === "laravel"
        ? "  import { buildPlaygroundEntries } from './playground/buildRegistry'; // adjust relative path from your entry file"
        : "  import { buildPlaygroundEntries } from './playground/buildRegistry';",
      "",
      "  const dslinterReport = useWorkspaceReport({ reportUrl: '/dslint-report.json', watchUrl: '/events' });",
      "  const playgroundEntries = useMemo(() => buildPlaygroundEntries(dslinterReport.report), [dslinterReport.report]);",
      "",
      "  <DashboardLayout playgroundEntries={playgroundEntries} dslinterReport={dslinterReport} ... />",
      "",
      "Run the scanner from the repo root: npx dslinter .",
      "",
    ].join("\n"),
  );

  process.stdout.write(
    [
      "dslinter init: wrote playground registry",
      `  ${registryPath}`,
      "",
      `Layout: ${layout}`,
      "",
      "Next:",
      `  1. Import buildPlaygroundEntries in your App (see ${registryDir}/README.txt)`,
      "  2. Merge vite.dslinter.snippet.ts into vite.config.ts (proxy, react dedupe, optimizeDeps.exclude)",
      layout === "laravel"
        ? "     No extra @ alias remapping is required — dslinter UI uses relative imports."
        : "     No @ alias overrides needed for dslinter internal UI.",
      "  3. Run npx dslinter . from the project root",
      "",
    ].join("\n"),
  );
}
