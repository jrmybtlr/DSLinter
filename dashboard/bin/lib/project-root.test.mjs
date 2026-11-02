import { workspaceCacheDir } from "./cache.mjs";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultReportPath,
  ensureDashboardBuilt,
  canRunEmbedVite,
  embedServeConfigPath,
  hasEmbedDashboard,
} from "./project-root.mjs";

describe("ensureDashboardBuilt (published install layout)", () => {
  it("returns prebuilt dashboard-dist without spawning build when embed sources are absent", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-published-"));
    mkdirSync(join(root, "dashboard-dist"), { recursive: true });
    writeFileSync(join(root, "dashboard-dist", "index.html"), "<!doctype html>");
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "index.ts"), "export {};\n");

    expect(hasEmbedDashboard(root)).toBe(false);
    expect(canRunEmbedVite(root)).toBe(false);

    const dist = ensureDashboardBuilt(root);
    expect(dist).toBeTruthy();
    expect(dist).toContain("dashboard-dist");
  });

  it("canRunEmbedVite when published embed sources exist without root vite.config.ts", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-published-embed-"));
    mkdirSync(join(root, "dashboard-dist"), { recursive: true });
    writeFileSync(join(root, "dashboard-dist", "index.html"), "<!doctype html>");
    mkdirSync(join(root, "embed"), { recursive: true });
    writeFileSync(join(root, "embed", "main.tsx"), "export {};\n");
    mkdirSync(join(root, "vite"), { recursive: true });
    writeFileSync(join(root, "vite", "embed-serve.config.ts"), "export default {};\n");

    expect(hasEmbedDashboard(root)).toBe(false);
    expect(canRunEmbedVite(root)).toBe(true);
    expect(embedServeConfigPath(root)).toBe(join(root, "vite", "embed-serve.config.ts"));

    const dist = ensureDashboardBuilt(root);
    expect(dist).toBeTruthy();
    expect(dist).toContain("dashboard-dist");
  });
});

describe("defaultReportPath", () => {
  it("keeps implicit subdirectory reports outside the project", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-laravel-"));
    const components = join(root, "resources", "js", "Components");
    mkdirSync(components, { recursive: true });
    writeFileSync(join(root, "vite.config.js"), "export default {};\n");

    const reportPath = defaultReportPath(components, null);
    expect(reportPath).toBe(join(workspaceCacheDir(components), "dslinter-report.json"));
  });

  it("uses the workspace cache at a Vite root", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-vite-root-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "vite.config.ts"), "export default {};\n");

    const reportPath = defaultReportPath(root, null);
    expect(reportPath).toBe(join(workspaceCacheDir(root), "dslinter-report.json"));
  });

  it("honors explicit --output", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-out-"));
    const custom = join(root, "custom-report.json");
    expect(defaultReportPath(root, custom)).toBe(custom);
  });
});
