import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildAgentContext } from "./agent-context";
import {
  catalogSummary,
  componentSpec,
  findingsQuery,
  governanceSummary,
  tokenSummary,
} from "./agent-query";
import { normalizeReportPaths } from "./normalize-paths";
import type { WorkspaceReport } from "../types/report";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoReportPath = join(__dirname, "../../../../demo/react/public/dslinter-report.json");

function loadDemoReport(): WorkspaceReport {
  const raw = readFileSync(demoReportPath, "utf8");
  return normalizeReportPaths(JSON.parse(raw) as WorkspaceReport);
}

describe("normalizeReportPaths", () => {
  it("strips root prefix from paths", () => {
    const report = loadDemoReport();
    for (const f of report.files) {
      expect(f.path.startsWith("/")).toBe(false);
    }
  });
});

describe("agent-query", () => {
  it("returns catalog sorted by usage", () => {
    const report = loadDemoReport();
    const catalog = catalogSummary(report, { limit: 10 });
    expect(catalog.length).toBeGreaterThan(0);
    for (let i = 1; i < catalog.length; i++) {
      expect(catalog[i - 1]!.reference_count).toBeGreaterThanOrEqual(
        catalog[i]!.reference_count,
      );
    }
  });

  it("returns Button spec with example jsx", () => {
    const report = loadDemoReport();
    const spec = componentSpec(report, "Button");
    expect(spec).not.toBeNull();
    expect(spec!.example_jsx).toMatch(/Button/);
  });

  it("filters findings by rule prefix", () => {
    const report = loadDemoReport();
    const rows = findingsQuery(report, { rule_prefix: "a11y-", limit: 5 });
    expect(rows.every((f) => f.rule_id.startsWith("a11y-"))).toBe(true);
  });

  it("summarizes governance", () => {
    const report = loadDemoReport();
    const gov = governanceSummary(report);
    expect(gov.scores.design_system_health).toBeGreaterThan(0);
    expect(gov.total_findings).toBeGreaterThan(0);
  });

  it("lists css tokens", () => {
    const report = loadDemoReport();
    const tokens = tokenSummary(report);
    expect(tokens.tokens.length).toBeGreaterThan(0);
  });
});

describe("agent-context", () => {
  it("builds markdown context", () => {
    const report = loadDemoReport();
    const md = buildAgentContext(report, { format: "markdown" });
    expect(String(md)).toContain("Governance scores");
    expect(String(md)).toContain("Top components");
  });

  it("builds json context", () => {
    const report = loadDemoReport();
    const json = buildAgentContext(report, { format: "json" }) as Record<
      string,
      unknown
    >;
    expect(json.scores).toBeDefined();
    expect(Array.isArray(json.top_components)).toBe(true);
  });
});
