import { describe, expect, it } from "vitest";
import {
  dashboardSharesScannerPort,
  formatMcpAgentHint,
  formatMcpDataStatus,
  getLanIpv4Addresses,
  httpUrl,
  scannerApiUrl,
} from "./network-hosts.mjs";

describe("scannerApiUrl", () => {
  it("formats loopback scanner URL", () => {
    expect(scannerApiUrl(7878)).toBe("http://127.0.0.1:7878/");
  });
});

describe("formatMcpDataStatus", () => {
  it("shows live data URL when scanner is up", () => {
    expect(formatMcpDataStatus(7878, true)).toBe(
      "live @ http://127.0.0.1:7878",
    );
  });

  it("notes offline scanner", () => {
    expect(formatMcpDataStatus(7878, false)).toContain("report file");
  });
});

describe("formatMcpAgentHint", () => {
  it("prompts setup when not configured", () => {
    expect(formatMcpAgentHint(false)).toContain("add dslinter");
    expect(formatMcpAgentHint(false)).toContain(".cursor/mcp.json");
  });

  it("notes Cursor spawns MCP when configured", () => {
    expect(formatMcpAgentHint(true)).toContain("Cursor spawns MCP");
  });
});

describe("dashboardSharesScannerPort", () => {
  it("detects bundled dashboard on scanner port", () => {
    expect(dashboardSharesScannerPort("http://127.0.0.1:7878/", 7878)).toBe(true);
    expect(dashboardSharesScannerPort("http://localhost:5173/", 7878)).toBe(false);
  });
});

describe("getLanIpv4Addresses", () => {
  it("returns an array", () => {
    expect(Array.isArray(getLanIpv4Addresses())).toBe(true);
  });
});

describe("httpUrl", () => {
  it("builds URL with custom host", () => {
    expect(httpUrl(7878, "192.168.1.10")).toBe("http://192.168.1.10:7878/");
  });
});
