import { mkdtempSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect } from "vitest";
import { discoverApps, findWorkspaceRoot, selectApp } from "./workspace.mjs";
import { workspaceCacheDir } from "./cache.mjs";
import { resolveScanAndProjectRoots, withScannerScanPath } from "./resolve-project.mjs";

describe("workspace discovery", () => {
  it("finds React and Vue apps without evaluating config or writing files", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-workspace-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ workspaces: ["apps/*"] }));
    for (const [name, framework] of [
      ["web", "react"],
      ["admin", "vue"],
    ]) {
      const app = join(root, "apps", name);
      mkdirSync(app, { recursive: true });
      writeFileSync(
        join(app, "package.json"),
        JSON.stringify({ name, dependencies: { [framework]: "*" } }),
      );
      writeFileSync(
        join(app, "vite.config.ts"),
        "throw new Error('Config must not execute during discovery');",
      );
    }
    const before = readdirSync(root, { recursive: true });
    const apps = discoverApps(root);
    expect(apps.map((app) => app.framework)).toEqual(["vue", "react"]);
    expect(selectApp(apps, "web").id).toBe("apps/web");
    expect(selectApp(apps, null, join(root, "apps/admin/src")).framework).toBe("vue");
    expect(findWorkspaceRoot(join(root, "apps/admin"))).toBe(root);
    expect(resolveScanAndProjectRoots(null, join(root, "apps/admin")).scanPath).toBe(root);
    expect(workspaceCacheDir(root).startsWith(root + "/")).toBe(false);
    expect(readdirSync(root, { recursive: true })).toEqual(before);
  });

  it("does not replace option values with the scan path", () => {
    expect(
      withScannerScanPath(["--output", "/tmp/report.json", "--max-warnings", "2"], "/repo"),
    ).toEqual(["/repo", "--output", "/tmp/report.json", "--max-warnings", "2"]);
  });
});
