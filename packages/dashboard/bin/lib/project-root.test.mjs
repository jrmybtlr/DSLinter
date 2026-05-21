import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureDashboardBuilt, hasEmbedDashboard } from "./project-root.mjs";

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
