import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildMcpConfig } from "./config";
import { ReportCache } from "./report-cache";
import { createDslinterMcpServer } from "./server";
import { ruleCatalog } from "./rule-catalog";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoRoot = join(__dirname, "../../../../demo/react");
const demoReportPath = join(demoRoot, "public/dslinter-report.json");

describe("MCP server", () => {
  it("creates server with tools registered", () => {
    const config = buildMcpConfig({
      scanPath: demoRoot,
      projectRoot: demoRoot,
      reportPath: demoReportPath,
    });
    const cache = new ReportCache(config);
    const server = createDslinterMcpServer(config, cache);
    expect(server).toBeDefined();
  });

  it("rule catalog has expected entries", () => {
    const rules = ruleCatalog();
    expect(rules.length).toBeGreaterThanOrEqual(20);
    expect(rules.some((r) => r.rule_id === "deprecated-component")).toBe(true);
  });

  it("loads demo report through cache", async () => {
    const config = buildMcpConfig({
      scanPath: demoRoot,
      projectRoot: demoRoot,
      reportPath: demoReportPath,
      ttlMs: 999_999_999,
    });
    const cache = new ReportCache(config);
    const report = await cache.getReport();
    expect(report.files.length).toBeGreaterThan(0);
    expect(readFileSync(demoReportPath, "utf8").length).toBeGreaterThan(100);
  });
});
