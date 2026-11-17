import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const SKIP = new Set([
  "node_modules",
  "vendor",
  "target",
  "dist",
  "build",
  "coverage",
  "storage",
  "bootstrap",
]);
const VITE_CONFIG = /^vite\.config\.(ts|mts|js|mjs|cts|cjs)$/;

export function readPackage(root) {
  try {
    return JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  } catch {
    return {};
  }
}

export function findWorkspaceRoot(start) {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    const pkg = readPackage(dir);
    if (existsSync(join(dir, "pnpm-workspace.yaml")) || pkg.workspaces) return dir;
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) break;
  }
  return null;
}

function appAt(dir, config, root) {
  const pkg = readPackage(dir);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  const configSource = readFileSync(join(dir, config), "utf8");
  const framework =
    deps.vue || deps["@inertiajs/vue3"] || configSource.includes("@vitejs/plugin-vue")
      ? "vue"
      : "react";
  return {
    id: relative(root, dir).replaceAll("\\", "/") || ".",
    root: dir,
    name: pkg.name || relative(root, dir) || "Application",
    framework,
    config: join(dir, config),
  };
}

/** Discover app contexts without executing application code or Vite plugins. */
export function discoverApps(root) {
  const apps = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const config = entries.find((entry) => entry.isFile() && VITE_CONFIG.test(entry.name));
    if (config && !existsSync(join(dir, "bin", "dslinter.mjs"))) {
      apps.push(appAt(dir, config.name, root));
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && !SKIP.has(entry.name))
        walk(join(dir, entry.name));
    }
  }
  walk(root);
  if (!apps.length) {
    for (let dir = dirname(resolve(root)); dirname(dir) !== dir; dir = dirname(dir)) {
      const names = readdirSync(dir);
      const config = names.find((name) => VITE_CONFIG.test(name));
      if (!config) continue;
      apps.push(appAt(dir, config, root));
      break;
    }
  }
  return apps.sort((a, b) => a.id.localeCompare(b.id));
}

export function selectApp(apps, requested, cwd = process.cwd()) {
  if (requested) {
    const absolute = resolve(cwd, requested);
    const app = apps.find(
      (app) => app.id === requested || app.root === absolute || app.name === requested,
    );
    if (!app)
      throw new Error(
        `dslinter: unknown --app ${requested}. Available: ${apps.map((app) => app.id).join(", ")}`,
      );
    return app;
  }
  return (
    apps
      .filter((app) => cwd === app.root || cwd.startsWith(app.root + "/"))
      .sort((a, b) => b.root.length - a.root.length)[0] ||
    apps[0] ||
    null
  );
}
