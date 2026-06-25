import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assessSetupReadiness, ensurePublicDir } from "./setup-readiness.mjs";

describe("assessSetupReadiness", () => {
  it("reports missing config and public", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-ready-"));
    const reportPath = join(root, "public", "dslinter-report.json");
    const issues = assessSetupReadiness(root, reportPath);
    expect(issues.map((i) => i.kind)).toContain("missing_config");
    expect(issues.map((i) => i.kind)).toContain("missing_public");
  });

  it("passes when config and public exist", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-ready-ok-"));
    mkdirSync(join(root, "public"), { recursive: true });
    const reportPath = join(root, "public", "dslinter-report.json");
    writeFileSync(join(root, ".dslinter.json"), "{}\n");
    expect(assessSetupReadiness(root, reportPath)).toHaveLength(0);
  });
});

describe("ensurePublicDir", () => {
  it("creates public directory", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-public-"));
    const reportPath = join(root, "public", "dslinter-report.json");
    ensurePublicDir(reportPath);
    expect(existsSync(join(root, "public"))).toBe(true);
  });
});
