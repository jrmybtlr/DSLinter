import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {{ targetDir?: string }} opts
 */
export function runInitMode(opts = {}) {
  const targetDir = resolve(opts.targetDir ?? process.cwd());
  const registryDir = join(targetDir, "src", "playground");
  const registryPath = join(registryDir, "buildRegistry.ts");
  const templatePath = join(
    packageRoot,
    "templates",
    "playground",
    "buildRegistry.ts",
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
      "  import { buildPlaygroundEntries } from './playground/buildRegistry';",
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
      "Next:",
      "  1. Import buildPlaygroundEntries in your App (see src/playground/README.txt)",
      "  2. Merge vite.dslinter.snippet.ts into vite.config.ts (proxy + react dedupe)",
      "  3. Run npx dslinter . from the project root",
      "",
    ].join("\n"),
  );
}
