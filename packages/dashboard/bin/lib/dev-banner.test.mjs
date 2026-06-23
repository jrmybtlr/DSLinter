import { describe, expect, it } from "vitest";
import {
  formatDevBanner,
  LOGO,
  shortenPath,
  visibleLength,
} from "./dev-banner.mjs";

describe("shortenPath", () => {
  it("replaces home with tilde", () => {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    if (!home) return;
    expect(shortenPath(`${home}/Projects/foo`, 80)).toBe("~/Projects/foo");
  });

  it("truncates long paths in the middle", () => {
    const long = "/very/long/path/segment/that/exceeds/the/maximum/allowed/length/for/display";
    const out = shortenPath(long, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out).toContain("…");
  });
});

describe("formatDevBanner", () => {
  it("includes logo, scan path, dashboard URL, and watch info", () => {
    const text = formatDevBanner({
      scanPath: "/tmp/components",
      reportPath: "/tmp/components/public/dslinter-report.json",
      apiPort: 7878,
      apiAvailable: true,
      dashboardUrl: "http://localhost:5173/",
      pollMs: 150,
    });
    expect(text).toContain(LOGO[0]);
    expect(text).toContain(LOGO[1]);
    expect(text).toContain("Scan path");
    expect(text).not.toContain("Report file");
    expect(text).toContain("Dashboard");
    expect(text).toContain("http://localhost:5173/");
    expect(text).toContain("Scanner API");
    expect(text).toContain("http://127.0.0.1:7878/");
    expect(text).toContain("MCP");
    expect(text).toContain("npx dslinter mcp");
    expect(text).not.toContain("dslinter-report.json");
    expect(text).not.toContain("/events");
    expect(text).toContain("polling every 150 ms");
    expect(text).toContain("Open the Dashboard in your browser");
  });

  it("shows bundled URL as the dashboard when no separate dev server", () => {
    const text = formatDevBanner({
      scanPath: "/tmp/components",
      reportPath: "/tmp/components/public/dslinter-report.json",
      apiPort: 7878,
      apiAvailable: true,
      bundledUrl: "http://127.0.0.1:7878/",
      pollMs: 150,
    });
    expect(text).toContain("Dashboard");
    expect(text).toContain("http://127.0.0.1:7878/");
    expect(text).toContain("MCP");
    expect(text).toContain("npx dslinter mcp");
    expect(text).not.toContain("Bundled UI");
    expect(text).not.toContain("Scanner API");
  });

  it("marks scanner unavailable when port is busy", () => {
    const text = formatDevBanner({
      scanPath: ".",
      reportPath: "./public/dslinter-report.json",
      apiPort: 7878,
      apiAvailable: false,
      dashboardUrl: "http://localhost:5174/",
    });
    expect(text).toContain("Scanner");
    expect(text).toContain("unavailable");
    expect(text).toContain("MCP");
    expect(text).toContain("report file");
    expect(text).not.toContain("/events");
  });

  it("keeps right border aligned on every row", () => {
    const text = formatDevBanner({
      scanPath: "/very/long/path/that/could/push/the/box/wider/than/usual/Components",
      reportPath: "/very/long/path/public/dslinter-report.json",
      apiPort: 7878,
      apiAvailable: false,
      dashboardUrl: "http://localhost:5175/",
      bundledUrl: "http://127.0.0.1:7878/",
      pollMs: 150,
    });
    const rows = text.split("\n").filter((l) => l.startsWith("│"));
    const widths = rows.map((l) => visibleLength(l));
    expect(new Set(widths).size).toBe(1);
    expect(rows.every((l) => l.endsWith("│"))).toBe(true);
  });
});

describe("visibleLength", () => {
  it("ignores ansi codes", () => {
    expect(visibleLength("\u001b[32mok\u001b[0m")).toBe(2);
    expect(visibleLength("\u001b[4;36mhttp://x\u001b[0m")).toBe(8);
  });
});
