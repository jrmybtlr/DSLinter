import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { detectInitLayout, ensureDslintConfig } from "../lib/scaffold-config.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

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

  const configResult = ensureDslintConfig({ targetDir, layout });
  const wroteRegistry = !existsSync(registryPath);
  if (wroteRegistry) {
    mkdirSync(registryDir, { recursive: true });
    copyFileSync(templatePath, registryPath);
  }

  const appHintPath = join(registryDir, "README.txt");
  if (wroteRegistry) {
    writeFileSync(
      appHintPath,
      [
        "Recommended (no registry file):",
        "",
        "  import { DashboardLayout, useWorkspaceReport } from 'dslinter';",
        "  const dslinterReport = useWorkspaceReport({ reportUrl: '/dslinter-report.json', watchUrl: '/events' });",
        "  <DashboardLayout autoPlayground dslinterReport={dslinterReport} ... />",
        "",
        "Optional — custom glob via this registry:",
        "",
        "  import { buildPlaygroundEntries } from './playground/buildRegistry';",
        "  <DashboardLayout playgroundEntries={buildPlaygroundEntries(dslinterReport.report)} ... />",
        "",
        "Run the scanner from the repo root: npx dslinter .",
        "",
      ].join("\n"),
    );
  }

  process.stdout.write(
    [
      wroteRegistry
        ? "dslinter init: wrote playground registry"
        : "dslinter init: playground registry already exists (kept)",
      `  ${registryPath}`,
      "",
      configResult.created
        ? "dslinter init: wrote config"
        : "dslinter init: config already exists (kept)",
      `  ${configResult.path}`,
      "",
      `Layout: ${layout}`,
      "",
      "Next:",
      `  1. Use <DashboardLayout autoPlayground /> (see ${registryDir}/README.txt)`,
      "  2. Run npx dslinter from the project root (merges dslinter/vite automatically)",
      "     Or add plugins: [dslinter()] from dslinter/vite for direct vite --mode serve",
      "  3. Optional: use buildRegistry.ts for a narrower glob or control overrides",
      "",
    ].join("\n"),
  );
}
