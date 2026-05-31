import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeDrift, suggestFix } from "./verify-loop";
import { normalizeReportPaths } from "./normalize-paths";
import type { WorkspaceReport } from "../types/report";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoReportPath = join(__dirname, "../../../../demo/public/dslinter-report.json");

function loadDemoReport(): WorkspaceReport {
  const raw = readFileSync(demoReportPath, "utf8");
  return normalizeReportPaths(JSON.parse(raw) as WorkspaceReport);
}

describe("verify-loop", () => {
  it("computes drift from baseline", () => {
    const report = loadDemoReport();
    const baseline = {
      saved_at: "2020-01-01T00:00:00Z",
      scores: {
        design_system_health: 100,
        ux_consistency: 100,
        accessibility: 100,
        maintainability: 100,
      },
      finding_count: 0,
    };
    const drift = computeDrift(report, baseline);
    expect(drift.finding_delta).toBeGreaterThan(0);
    expect(drift.score_deltas.design_system_health).toBeLessThan(0);
  });

  it("suggests fix for deprecated component", () => {
    const report = loadDemoReport();
    const fix = suggestFix(report, {
      rule_id: "deprecated-component",
      component: "LegacyButton",
    });
    expect(fix?.suggestion).toMatch(/LegacyButton|Replace/);
  });

  it("suggests fix for hardcoded color", () => {
    const report = loadDemoReport();
    const fix = suggestFix(report, { rule_id: "token-hardcoded-color" });
    expect(fix?.fix_hint).toBeTruthy();
  });
});
