import { describe, expect, it } from "vitest";
import {
  buildAppPreviewTheme,
  cssVariablesForPreviewTheme,
  isConsumerThemeDefinition,
  isDashboardThemePath,
} from "./appPreviewTheme";
import type { CssTokenDefinition, CssTokenSummary } from "../types/report";

const root = "/Users/dev/demo-inertia";

function def(
  partial: Partial<CssTokenDefinition> & Pick<CssTokenDefinition, "name" | "value" | "scope">,
): CssTokenDefinition {
  return {
    category: "other",
    path: `${root}/resources/css/app.css`,
    line: 1,
    ...partial,
  };
}

describe("isDashboardThemePath", () => {
  it("flags dslinter dashboard theme files", () => {
    expect(
      isDashboardThemePath(
        "/repo/packages/dashboard/src/styles/dashboard-theme.css",
      ),
    ).toBe(true);
    expect(isDashboardThemePath("/repo/node_modules/dslinter/theme.css")).toBe(
      true,
    );
  });
});

describe("isConsumerThemeDefinition", () => {
  it("accepts app css under report root", () => {
    expect(
      isConsumerThemeDefinition(
        def({ name: "--primary", value: "black", scope: "root" }),
        root,
      ),
    ).toBe(true);
  });

  it("rejects dashboard theme paths", () => {
    expect(
      isConsumerThemeDefinition(
        def({
          name: "--primary",
          value: "blue",
          scope: "root",
          path: "/repo/packages/dashboard/src/styles/dashboard-theme.css",
        }),
        root,
      ),
    ).toBe(false);
  });
});

describe("buildAppPreviewTheme", () => {
  it("extracts light root and dark selector tokens from consumer css", () => {
    const summary: CssTokenSummary = {
      definitions: [
        def({
          name: "--primary",
          value: "oklch(0.205 0 0)",
          scope: "root",
          line: 71,
        }),
        def({
          name: "--background",
          value: "oklch(1 0 0)",
          scope: "root",
          line: 65,
        }),
        def({
          name: "--color-primary",
          value: "var(--primary)",
          scope: "theme",
          line: 29,
        }),
        def({
          name: "--primary",
          value: "oklch(0.985 0 0)",
          scope: "selector",
          line: 107,
        }),
        def({
          name: "--background",
          value: "oklch(0.145 0 0)",
          scope: "selector",
          line: 101,
        }),
        def({
          name: "--primary",
          value: "oklch(0.488 0.243 264.376)",
          scope: "root",
          path: "/repo/packages/dashboard/src/styles/dashboard-theme.css",
          line: 100,
        }),
      ],
      usage_by_token: [],
    };

    const theme = buildAppPreviewTheme(summary, root);
    expect(theme).not.toBeNull();
    expect(theme!.light["--primary"]).toBe("oklch(0.205 0 0)");
    expect(theme!.light["--color-primary"]).toBe("oklch(0.205 0 0)");
    expect(theme!.dark["--primary"]).toBe("oklch(0.985 0 0)");
    expect(theme!.sourcePaths).toEqual([`${root}/resources/css/app.css`]);
  });

  it("returns null when only dashboard theme tokens exist", () => {
    const summary: CssTokenSummary = {
      definitions: [
        def({
          name: "--primary",
          value: "blue",
          scope: "root",
          path: "/repo/packages/dashboard/src/styles/dashboard-theme.css",
        }),
      ],
      usage_by_token: [],
    };

    expect(buildAppPreviewTheme(summary, root)).toBeNull();
  });
});

describe("cssVariablesForPreviewTheme", () => {
  it("merges dark overrides on top of light tokens", () => {
    const theme = {
      light: { "--background": "white", "--primary": "black" },
      dark: { "--background": "black", "--primary": "white" },
      sourcePaths: [],
    };

    expect(cssVariablesForPreviewTheme(theme, "light")).toEqual({
      "--background": "white",
      "--primary": "black",
    });
    expect(cssVariablesForPreviewTheme(theme, "dark")).toEqual({
      "--background": "black",
      "--primary": "white",
    });
  });
});
