import { describe, expect, it } from "vitest";
import { buildMergedTokenView } from "./mergeTokenCatalog";
import type { CssTokenDefinition, WorkspaceReport } from "../types/report";

const root = "/Users/dev/demo/inertia";

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

describe("buildMergedTokenView", () => {
  it("resolves var() color aliases to literal swatch values from root tokens", () => {
    const report: WorkspaceReport = {
      root,
      files: [],
      css_tokens: {
        definitions: [
          def({
            name: "--accent",
            value: "oklch(0.97 0 0)",
            scope: "root",
            line: 77,
          }),
          def({
            name: "--color-accent",
            value: "var(--accent)",
            scope: "theme",
            category: "color",
            line: 38,
          }),
          def({
            name: "--primary",
            value: "oklch(0.205 0 0)",
            scope: "root",
            line: 71,
          }),
          def({
            name: "--color-primary",
            value: "var(--primary)",
            scope: "theme",
            category: "color",
            line: 29,
          }),
        ],
        usage_by_token: [],
        unused_tokens: [],
      },
    };

    const view = buildMergedTokenView(report);
    expect(view).not.toBeNull();

    const accent = view!.rows.find((r) => r.cssName === "--color-accent");
    const primary = view!.rows.find((r) => r.cssName === "--color-primary");

    expect(accent?.displayValue).toBe("oklch(0.97 0 0)");
    expect(primary?.displayValue).toBe("oklch(0.205 0 0)");
  });

  it("prefers manual catalog display values over resolved scan values", () => {
    const report: WorkspaceReport = {
      root,
      files: [],
      css_tokens: {
        definitions: [
          def({
            name: "--primary",
            value: "oklch(0.205 0 0)",
            scope: "root",
            line: 71,
          }),
          def({
            name: "--color-primary",
            value: "var(--primary)",
            scope: "theme",
            category: "color",
            line: 29,
          }),
        ],
        usage_by_token: [],
        unused_tokens: [],
      },
    };

    const view = buildMergedTokenView(report, {
      colors: [
        {
          token: "primary",
          shade: "DEFAULT",
          value: "#2563eb",
          tw: "bg-primary",
        },
      ],
      spacing: [],
      radius: [],
    });

    const primary = view!.rows.find((r) => r.cssName === "--color-primary");
    expect(primary?.displayValue).toBe("#2563eb");
  });
});
