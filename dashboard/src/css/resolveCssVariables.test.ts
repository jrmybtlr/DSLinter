import { describe, expect, it } from "vitest";
import { resolveCssVariables } from "./resolveCssVariables";

describe("resolveCssVariables", () => {
  it("resolves simple var() references", () => {
    const vars = new Map([
      ["--accent", "oklch(0.97 0 0)"],
      ["--color-accent", "var(--accent)"],
    ]);

    expect(resolveCssVariables(vars)["--color-accent"]).toBe("oklch(0.97 0 0)");
  });

  it("resolves var() inside calc()", () => {
    const vars = new Map([
      ["--radius", "0.5rem"],
      ["--radius-md", "calc(var(--radius) * 0.8)"],
    ]);

    expect(resolveCssVariables(vars)["--radius-md"]).toBe("calc(0.5rem * 0.8)");
  });

  it("leaves unknown references unchanged", () => {
    const vars = new Map([["--color-accent", "var(--missing)"]]);
    expect(resolveCssVariables(vars)["--color-accent"]).toBe("var(--missing)");
  });

  it("handles var() with fallback without backtracking", () => {
    const vars = new Map([
      ["--primary", "oklch(0.205 0 0)"],
      ["--color-primary", "var(--primary, oklch(0 0 0))"],
    ]);

    expect(resolveCssVariables(vars)["--color-primary"]).toBe("oklch(0.205 0 0)");
  });

  it("completes quickly on adversarial input", () => {
    const attack = `var(---,${" ".repeat(10_000)}`;
    const vars = new Map([["--x", attack]]);

    const start = performance.now();
    resolveCssVariables(vars);
    expect(performance.now() - start).toBeLessThan(100);
  });
});
