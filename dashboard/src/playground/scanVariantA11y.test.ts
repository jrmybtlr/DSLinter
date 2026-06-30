import { describe, expect, it } from "vitest";
import {
  formatVariantLabel,
  mergePlaygroundA11yFindings,
  playgroundA11yScore,
} from "./scanVariantA11y";

describe("formatVariantLabel", () => {
  it("joins axis keys and values", () => {
    expect(
      formatVariantLabel(
        { variant: "destructive", size: "default", asChild: false },
        ["variant", "size"],
      ),
    ).toBe("variant=destructive size=default");
  });
});

describe("playgroundA11yScore", () => {
  it("combines static and variant findings", () => {
    const staticFindings = [
      {
        rule_id: "a11y-button-name",
        message: "missing name",
        path: "Button.tsx",
        line: 1,
        severity: "warning" as const,
      },
    ];
    const variantFindings = [
      {
        rule_id: "a11y-playground-color-contrast",
        message: "contrast too low",
        path: "",
        line: null,
        severity: "error" as const,
        variant_label: "variant=destructive size=default",
      },
    ];

    expect(
      mergePlaygroundA11yFindings(staticFindings, variantFindings),
    ).toHaveLength(2);
    expect(playgroundA11yScore(staticFindings, variantFindings)).toBe(65);
  });
});
