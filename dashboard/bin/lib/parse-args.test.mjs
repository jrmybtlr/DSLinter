import { describe, expect, it } from "vitest";
import { parseDslinterArgs } from "./parse-args.mjs";

describe("parseDslinterArgs", () => {
  it("defaults to dev locally", () => {
    const prev = process.env.CI;
    delete process.env.CI;
    expect(parseDslinterArgs([]).mode).toBe("dev");
    process.env.CI = prev;
  });

  it("defaults to report in CI", () => {
    const prev = process.env.CI;
    process.env.CI = "true";
    expect(parseDslinterArgs([]).mode).toBe("report");
    process.env.CI = prev;
  });

  it("rejects multiple mode flags", () => {
    expect(() => parseDslinterArgs(["--report", "--watch"])).toThrow(/mutually exclusive/);
  });

  it("passes through scanner flags", () => {
    const p = parseDslinterArgs(["--report", "demo", "-p", "--json"]);
    expect(p.mode).toBe("report");
    expect(p.scannerArgs).toEqual(["demo", "-p", "--json"]);
    expect(p.scanPath).toContain("demo");
  });

  it("parses --yes flag", () => {
    const p = parseDslinterArgs(["--yes"]);
    expect(p.yes).toBe(true);
  });


  it("uses scanner mode for --serve only", () => {
    expect(parseDslinterArgs([".", "--serve", "7878"]).mode).toBe("scanner");
  });

  it("extracts output and serve ports", () => {
    const p = parseDslinterArgs(["--watch", "--output", "out.json", "--serve", "9"]);
    expect(p.mode).toBe("watch");
    expect(p.outputPath).toBe("out.json");
    expect(p.servePort).toBe(9);
  });

  it("parses --serve=port", () => {
    const p = parseDslinterArgs(["--serve=7878"]);
    expect(p.mode).toBe("scanner");
    expect(p.servePort).toBe(7878);
  });

  it("does not use scanner mode when --serve port is missing or invalid", () => {
    const prev = process.env.CI;
    delete process.env.CI;
    for (const argv of [
      ["--serve"],
      ["--serve", ""],
      ["--serve", "abc"],
      ["--serve=not-a-port"],
      ["--serve", "0"],
      ["--serve=70000"],
    ]) {
      const p = parseDslinterArgs(argv);
      expect(p.servePort).toBeNull();
      expect(p.mode).toBe("dev");
    }
    process.env.CI = prev;
  });
});
