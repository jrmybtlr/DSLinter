import { describe, expect, it } from "vitest";
import { a11yScoreFromFindings } from "./a11yScoring";

describe("a11yScoreFromFindings", () => {
  it("starts at 100 with no findings", () => {
    expect(a11yScoreFromFindings([])).toBe(100);
  });

  it("applies severity penalties", () => {
    expect(
      a11yScoreFromFindings([
        { severity: "error" },
        { severity: "warning" },
        { severity: "info" },
      ]),
    ).toBe(62);
  });

  it("never drops below zero", () => {
    expect(
      a11yScoreFromFindings(Array.from({ length: 10 }, () => ({ severity: "error" as const }))),
    ).toBe(0);
  });
});
