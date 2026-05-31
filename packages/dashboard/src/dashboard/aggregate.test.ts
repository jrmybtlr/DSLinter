import { describe, expect, it } from "vitest";
import type { WorkspaceReport } from "../types/report";
import { componentCatalogFamiliesFromReport, componentCatalogTreeFromReport } from "./aggregate";

function reportWithDefinitions(
  definitions: WorkspaceReport["files"][number]["definitions"],
  path = "/repo/src/components/ui/dropdown-menu.tsx",
): WorkspaceReport {
  return {
    root: "/repo",
    files: [
      {
        path,
        definitions,
        usages: [],
        parse_errors: [],
      },
    ],
    findings: [],
    duplicate_components: [],
    usage_by_component: [],
    scores: {
      design_system_health: 0,
      ux_consistency: 0,
      accessibility: 0,
      maintainability: 0,
    },
  };
}

describe("componentCatalogFamiliesFromReport", () => {
  it("groups shadcn-style kebab filename exports under the normalized root", () => {
    const report = reportWithDefinitions([
      { name: "DropdownMenu", kind: "function", line: 1 },
      { name: "DropdownMenuContent", kind: "function", line: 2 },
      { name: "DropdownMenuItem", kind: "function", line: 3 },
      { name: "DropdownMenuTrigger", kind: "function", line: 4 },
    ]);

    expect(componentCatalogFamiliesFromReport(report)).toEqual([
      {
        parent: "DropdownMenu",
        children: ["DropdownMenuContent", "DropdownMenuItem", "DropdownMenuTrigger"],
        path: "/repo/src/components/ui/dropdown-menu.tsx",
      },
    ]);
  });

  it("leaves single export files flat", () => {
    const report = reportWithDefinitions(
      [{ name: "Button", kind: "function", line: 1 }],
      "/repo/src/components/ui/button.tsx",
    );

    expect(componentCatalogFamiliesFromReport(report)).toEqual([]);
    expect(componentCatalogTreeFromReport(report)).toEqual([{ type: "component", name: "Button" }]);
  });

  it("does not group sibling exports when no export matches the filename root", () => {
    const report = reportWithDefinitions(
      [
        { name: "MenuRoot", kind: "function", line: 1 },
        { name: "MenuItem", kind: "function", line: 2 },
      ],
      "/repo/src/components/ui/dropdown-menu.tsx",
    );

    expect(componentCatalogFamiliesFromReport(report)).toEqual([]);
    expect(componentCatalogTreeFromReport(report)).toEqual([
      { type: "component", name: "MenuItem" },
      { type: "component", name: "MenuRoot" },
    ]);
  });
});
