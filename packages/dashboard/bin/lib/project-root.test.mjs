import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultReportPath,
  ensureDashboardBuilt,
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

    const dist = ensureDashboardBuilt(root);
    expect(dist).toBeTruthy();
    expect(dist).toContain("dashboard-dist");
  });
});

describe("defaultReportPath", () => {
  it("writes to project public/ when scan path is a subdirectory of vite root", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-laravel-"));
    const components = join(root, "resources", "js", "Components");
    mkdirSync(components, { recursive: true });
    writeFileSync(join(root, "vite.config.js"), "export default {};\n");

    const reportPath = defaultReportPath(components, null);
    expect(reportPath).toBe(join(root, "public", "dslinter-report.json"));
  });

  it("uses scan path public/ when scan path is the vite root", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-vite-root-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "vite.config.ts"), "export default {};\n");

    const reportPath = defaultReportPath(root, null);
    expect(reportPath).toBe(join(root, "public", "dslinter-report.json"));
  });

  it("honors explicit --output", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-out-"));
    const custom = join(root, "custom-report.json");
    expect(defaultReportPath(root, custom)).toBe(custom);
  });
});
