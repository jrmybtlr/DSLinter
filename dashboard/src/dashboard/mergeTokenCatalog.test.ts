import { describe, expect, it } from "vitest";
import { buildMergedTokenView, searchTokenRows } from "./mergeTokenCatalog";
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

  it("pairs root and selector definitions of the same token into one row", () => {
    const report: WorkspaceReport = {
      root,
      files: [],
      css_tokens: {
        definitions: [
          def({
            name: "--primary",
            value: "oklch(0.205 0 0)",
            scope: "root",
            category: "color",
            line: 73,
          }),
          def({
            name: "--primary",
            value: "oklch(0.985 0 0)",
            scope: "selector",
            category: "color",
            line: 109,
          }),
          def({
            name: "--radius",
            value: "0.625rem",
            scope: "root",
            category: "radius",
            line: 91,
          }),
        ],
        usage_by_token: [],
        unused_tokens: [],
      },
    };

    const view = buildMergedTokenView(report);
    expect(view).not.toBeNull();

    const primaryRows = view!.rows.filter((r) => r.cssName === "--primary");
    expect(primaryRows).toHaveLength(1);

    const primary = primaryRows[0]!;
    expect(primary.value).toBe("oklch(0.205 0 0)");
    expect(primary.displayValue).toBe("oklch(0.205 0 0)");
    expect(primary.darkValue).toBe("oklch(0.985 0 0)");
    expect(primary.darkDisplayValue).toBe("oklch(0.985 0 0)");
    expect(primary.scope).toBe("root");
    expect(primary.darkLine).toBe(109);

    const radius = view!.rows.find((r) => r.cssName === "--radius");
    expect(radius?.darkValue).toBeUndefined();
    expect(radius?.value).toBe("0.625rem");

    expect(view!.rows).toHaveLength(2);
  });
});

describe("searchTokenRows", () => {
  it("matches name, value, dark value, and tw class", () => {
    const rows = [
      {
        cssName: "--primary",
        value: "oklch(0.205 0 0)",
        darkValue: "oklch(0.985 0 0)",
        category: "color" as const,
        scope: "root",
        path: "app.css",
        line: 1,
        referenceCount: 0,
        fileCount: 0,
        isUnused: true,
        tw: "bg-primary",
        usageFiles: [],
      },
      {
        cssName: "--radius",
        value: "0.625rem",
        category: "radius" as const,
        scope: "root",
        path: "app.css",
        line: 2,
        referenceCount: 0,
        fileCount: 0,
        isUnused: true,
        usageFiles: [],
      },
    ];

    expect(searchTokenRows(rows, "PRIMARY")).toHaveLength(1);
    expect(searchTokenRows(rows, "0.985")).toHaveLength(1);
    expect(searchTokenRows(rows, "bg-primary")).toHaveLength(1);
    expect(searchTokenRows(rows, "0.625")).toHaveLength(1);
    expect(searchTokenRows(rows, "missing")).toHaveLength(0);
    expect(searchTokenRows(rows, "  ")).toHaveLength(2);
  });
});
