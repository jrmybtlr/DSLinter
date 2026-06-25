import { describe, expect, it } from "vitest";
import { findColorTokenForHex, normalizeHex, parseCssColor } from "./css-color";
import type { CssTokenDefinition } from "../types/report";

function colorDef(name: string, value: string): CssTokenDefinition {
  return {
    name,
    value,
    category: "color",
    scope: "theme",
    path: "theme.css",
    line: 1,
  };
}

describe("css-color", () => {
  it("normalizes shorthand hex", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("#DC2626")).toBe("#dc2626");
  });

  it("parses rgb to hex", () => {
    expect(parseCssColor("rgb(220, 38, 38)")).toBe("#dc2626");
    expect(parseCssColor("rgba(220, 38, 38, 0.5)")).toBe("#dc2626");
  });

  it("finds token by normalized hex when value is rgb", () => {
    const defs = [colorDef("--color-danger", "rgb(220, 38, 38)")];
    const token = findColorTokenForHex(defs, "#dc2626");
    expect(token?.name).toBe("--color-danger");
  });

  it("finds token when value is hex and finding uses shorthand", () => {
    const defs = [colorDef("--color-danger", "#dc2626")];
    const token = findColorTokenForHex(defs, "#dc2626");
    expect(token?.name).toBe("--color-danger");
  });

  it("resolves var() chains before matching", () => {
    const defs = [
      colorDef("--primary", "#93c5fd"),
      colorDef("--color-primary", "var(--primary)"),
    ];
    const token = findColorTokenForHex(defs, "#93c5fd");
    expect(token?.name).toBe("--color-primary");
  });

  it("returns undefined when no token matches", () => {
    const defs = [colorDef("--color-danger", "rgb(220, 38, 38)")];
    expect(findColorTokenForHex(defs, "#ff0066")).toBeUndefined();
  });
});
