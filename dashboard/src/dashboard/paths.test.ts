import { describe, expect, it } from "vitest";
import { resolveReportAbsolutePath, truncatePathMiddle } from "./paths";

const SAMPLE =
  "resources/js/components/manage-two-factor.tsx";

describe("resolveReportAbsolutePath", () => {
  it("returns absolute paths unchanged when under root", () => {
    expect(
      resolveReportAbsolutePath(
        "/repo",
        "/repo/src/components/Button.tsx",
      ),
    ).toBe("/repo/src/components/Button.tsx");
  });

  it("joins root-relative paths", () => {
    expect(
      resolveReportAbsolutePath("/repo", "src/pages/Home.tsx"),
    ).toBe("/repo/src/pages/Home.tsx");
  });
});

describe("truncatePathMiddle", () => {
  it("returns the path unchanged when it fits", () => {
    expect(truncatePathMiddle(SAMPLE, 100)).toBe(SAMPLE);
    expect(truncatePathMiddle(SAMPLE, SAMPLE.length)).toBe(SAMPLE);
  });

  it("drops middle directories while keeping filename", () => {
    expect(truncatePathMiddle(SAMPLE, 41)).toBe(
      "resources/js/.../manage-two-factor.tsx",
    );
  });

  it("progressively collapses more leading segments", () => {
    expect(truncatePathMiddle(SAMPLE, 37)).toBe(
      "resources/.../manage-two-factor.tsx",
    );
    expect(truncatePathMiddle(SAMPLE, 27)).toBe(
      ".../manage-two-factor.tsx",
    );
  });

  it("normalizes backslashes", () => {
    expect(
      truncatePathMiddle(
        "resources\\js\\components\\manage-two-factor.tsx",
        100,
      ),
    ).toBe(SAMPLE);
  });

  it("returns a single long filename when there are no directories", () => {
    const filename = "manage-two-factor-with-a-very-long-name.tsx";
    expect(truncatePathMiddle(filename, 10)).toBe(filename);
  });

  it("prefers filename over prefix when budget is too small for ellipsis", () => {
    expect(truncatePathMiddle(SAMPLE, 5)).toBe("manage-two-factor.tsx");
  });

  it("handles empty path", () => {
    expect(truncatePathMiddle("", 10)).toBe("");
  });
});
