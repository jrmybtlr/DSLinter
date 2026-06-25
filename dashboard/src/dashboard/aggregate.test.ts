import { describe, expect, it } from "vitest";
import type { WorkspaceReport } from "../types/report";
import {
  componentCatalogFamiliesFromReport,
  componentCatalogNamesFromReport,
  componentCatalogTreeFromReport,
  fileStemToCatalogGroupLabel,
  findingsForGovernanceTab,
  governanceTabCounts,
  resolveFamilyNavigationTarget,
  unusedComponentsFromReport,
} from "./aggregate";

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

describe("fileStemToCatalogGroupLabel", () => {
  it("converts kebab-case file stems to PascalCase group labels", () => {
    expect(fileStemToCatalogGroupLabel("hover-card")).toBe("HoverCard");
    expect(fileStemToCatalogGroupLabel("dropdown-menu")).toBe("DropdownMenu");
    expect(fileStemToCatalogGroupLabel("icons")).toBe("Icons");
  });
});

describe("componentCatalogFamiliesFromReport", () => {
  it("groups multi-export files under the filename stem", () => {
    const report = reportWithDefinitions([
      { name: "DropdownMenu", kind: "function", line: 1 },
      { name: "DropdownMenuContent", kind: "function", line: 2 },
      { name: "DropdownMenuItem", kind: "function", line: 3 },
      { name: "DropdownMenuTrigger", kind: "function", line: 4 },
    ]);

    expect(componentCatalogFamiliesFromReport(report)).toEqual([
      {
        parent: "DropdownMenu",
        children: [
          "DropdownMenu",
          "DropdownMenuContent",
          "DropdownMenuItem",
          "DropdownMenuTrigger",
        ],
        path: "/repo/src/components/ui/dropdown-menu.tsx",
      },
    ]);
  });

  it("groups icon-style sibling exports under the filename stem", () => {
    const report = reportWithDefinitions(
      [
        { name: "IconSearch", kind: "wrapped_component", line: 15 },
        { name: "IconCheck", kind: "wrapped_component", line: 31 },
        { name: "IconChevronDown", kind: "wrapped_component", line: 46 },
      ],
      "/repo/src/components/icons.tsx",
    );

    expect(componentCatalogFamiliesFromReport(report)).toEqual([
      {
        parent: "Icons",
        children: ["IconCheck", "IconChevronDown", "IconSearch"],
        path: "/repo/src/components/icons.tsx",
      },
    ]);
  });

  it("leaves single export files flat", () => {
    const report = reportWithDefinitions(
      [{ name: "Button", kind: "function", line: 1 }],
      "/repo/src/components/ui/button.tsx",
    );

    expect(componentCatalogFamiliesFromReport(report)).toEqual([]);
    expect(componentCatalogTreeFromReport(report)).toEqual([
      { type: "component", name: "Button" },
    ]);
  });

  it("folds usage-only root exports into the file group instead of duplicating the label", () => {
    const selectPath = "/repo/src/components/ui/select.tsx";
    const report: WorkspaceReport = {
      root: "/repo",
      files: [
        {
          path: selectPath,
          definitions: [
            { name: "SelectTrigger", kind: "wrapped_component", line: 12 },
            { name: "SelectContent", kind: "wrapped_component", line: 60 },
            { name: "SelectItem", kind: "wrapped_component", line: 104 },
          ],
          usages: [],
          parse_errors: [],
        },
      ],
      findings: [],
      duplicate_components: [],
      usage_by_component: [
        {
          component: "Select",
          reference_count: 2,
          file_count: 1,
          max_props_on_single_use: 1,
          files: ["/repo/src/components/PlaygroundControlField.tsx"],
        },
        {
          component: "SelectValue",
          reference_count: 1,
          file_count: 1,
          max_props_on_single_use: 1,
          files: ["/repo/src/components/PlaygroundControlField.tsx"],
        },
      ],
      scores: {
        design_system_health: 0,
        ux_consistency: 0,
        accessibility: 0,
        maintainability: 0,
      },
    };

    expect(componentCatalogFamiliesFromReport(report)).toEqual([
      {
        parent: "Select",
        children: [
          "Select",
          "SelectContent",
          "SelectItem",
          "SelectTrigger",
          "SelectValue",
        ],
        path: selectPath,
      },
    ]);
    expect(componentCatalogTreeFromReport(report)).toEqual([
      {
        type: "family",
        parent: "Select",
        children: [
          "Select",
          "SelectContent",
          "SelectItem",
          "SelectTrigger",
          "SelectValue",
        ],
        path: selectPath,
      },
    ]);
  });

  it("groups sibling exports even when no export matches the filename root", () => {
    const report = reportWithDefinitions([
      { name: "MenuRoot", kind: "function", line: 1 },
      { name: "MenuItem", kind: "function", line: 2 },
    ]);

    expect(componentCatalogFamiliesFromReport(report)).toEqual([
      {
        parent: "DropdownMenu",
        children: ["MenuItem", "MenuRoot"],
        path: "/repo/src/components/ui/dropdown-menu.tsx",
      },
    ]);
    expect(componentCatalogTreeFromReport(report)).toEqual([
      {
        type: "family",
        parent: "DropdownMenu",
        children: ["MenuItem", "MenuRoot"],
        path: "/repo/src/components/ui/dropdown-menu.tsx",
      },
    ]);
  });
});

describe("componentCatalogTreeFromReport", () => {
  it("includes file-stem families when the parent label is not a catalog name", () => {
    const report = reportWithDefinitions(
      [
        { name: "IconSearch", kind: "wrapped_component", line: 15 },
        { name: "IconCheck", kind: "wrapped_component", line: 31 },
      ],
      "/repo/src/components/icons.tsx",
    );

    const names = componentCatalogNamesFromReport(report);
    expect(names).toEqual(["IconCheck", "IconSearch"]);
    expect(names).not.toContain("Icons");

    const tree = componentCatalogTreeFromReport(report);
    expect(tree).toEqual([
      {
        type: "family",
        parent: "Icons",
        children: ["IconCheck", "IconSearch"],
        path: "/repo/src/components/icons.tsx",
      },
    ]);
  });
});

describe("resolveFamilyNavigationTarget", () => {
  it("prefers a child export whose normalized name matches the file stem", () => {
    const family = {
      parent: "DropdownMenu",
      children: [
        "DropdownMenu",
        "DropdownMenuContent",
        "DropdownMenuItem",
        "DropdownMenuTrigger",
      ],
      path: "/repo/src/components/ui/dropdown-menu.tsx",
    };
    const names = componentCatalogNamesFromReport(reportWithDefinitions([]));

    expect(
      resolveFamilyNavigationTarget(family, [
        ...names,
        "DropdownMenu",
        "DropdownMenuContent",
        "DropdownMenuItem",
        "DropdownMenuTrigger",
      ]),
    ).toBe("DropdownMenu");
  });

  it("falls back to the first child when no export matches the file stem", () => {
    const family = {
      parent: "Icons",
      children: ["IconCheck", "IconSearch"],
      path: "/repo/src/components/icons.tsx",
    };

    expect(resolveFamilyNavigationTarget(family, ["IconCheck", "IconSearch"])).toBe(
      "IconCheck",
    );
  });
});

describe("unusedComponentsFromReport", () => {
  it("returns defined components with zero references", () => {
    const report: WorkspaceReport = {
      root: "/repo",
      files: [
        {
          path: "/repo/src/components/ui/button.tsx",
          definitions: [{ name: "Button", kind: "function", line: 1 }],
          usages: [],
          parse_errors: [],
        },
        {
          path: "/repo/src/components/ui/badge.tsx",
          definitions: [{ name: "Badge", kind: "function", line: 1 }],
          usages: [],
          parse_errors: [],
        },
      ],
      findings: [],
      duplicate_components: [],
      usage_by_component: [
        {
          component: "Button",
          reference_count: 12,
          file_count: 4,
          max_props_on_single_use: 2,
          files: ["/repo/src/pages/home.tsx"],
        },
      ],
      scores: {
        design_system_health: 0,
        ux_consistency: 0,
        accessibility: 0,
        maintainability: 0,
      },
    };

    expect(unusedComponentsFromReport(report)).toEqual([
      {
        name: "Badge",
        definitionPaths: ["/repo/src/components/ui/badge.tsx"],
      },
    ]);
  });

  it("excludes hidden components", () => {
    const report: WorkspaceReport = {
      root: "/repo",
      files: [
        {
          path: "/repo/src/components/ui/ghost.tsx",
          definitions: [{ name: "Ghost", kind: "function", line: 1 }],
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
      config: { hidden_components: ["Ghost"] },
    };

    expect(unusedComponentsFromReport(report)).toEqual([]);
  });
});

describe("governanceTabCounts", () => {
  it("counts findings by pillar and unused components", () => {
    const report: WorkspaceReport = {
      root: "/repo",
      files: [
        {
          path: "/repo/src/components/ui/badge.tsx",
          definitions: [
            { name: "Badge", kind: "function", line: 1 },
            { name: "Ghost", kind: "function", line: 2 },
          ],
          usages: [],
          parse_errors: [],
        },
      ],
      findings: [
        {
          rule_id: "a11y-missing-alt",
          message: "Missing alt text",
          path: "/repo/src/pages/home.tsx",
          line: 1,
          severity: "error",
        },
        {
          rule_id: "code-console",
          message: "Console statement",
          path: "/repo/src/pages/home.tsx",
          line: 2,
          severity: "warning",
        },
        {
          rule_id: "token-tailwind-arbitrary",
          message: "Arbitrary token",
          path: "/repo/src/pages/home.tsx",
          line: 3,
          severity: "warning",
        },
      ],
      duplicate_components: [],
      usage_by_component: [],
      scores: {
        design_system_health: 0,
        ux_consistency: 0,
        accessibility: 0,
        maintainability: 0,
      },
    };

    expect(governanceTabCounts(report)).toEqual({
      all: 3,
      a11y: 1,
      code: 1,
      token: 1,
      unused: 2,
    });
  });
});

describe("findingsForGovernanceTab", () => {
  const findings: WorkspaceReport["findings"] = [
    {
      rule_id: "a11y-missing-alt",
      message: "Missing alt text",
      path: "/repo/src/pages/home.tsx",
      line: 1,
      severity: "error",
    },
    {
      rule_id: "code-console",
      message: "Console statement",
      path: "/repo/src/pages/home.tsx",
      line: 2,
      severity: "warning",
    },
    {
      rule_id: "token-tailwind-arbitrary",
      message: "Arbitrary token",
      path: "/repo/src/pages/home.tsx",
      line: 3,
      severity: "warning",
    },
  ];

  const report: WorkspaceReport = {
    root: "/repo",
    files: [],
    findings,
    duplicate_components: [],
    usage_by_component: [],
    scores: {
      design_system_health: 0,
      ux_consistency: 0,
      accessibility: 0,
      maintainability: 0,
    },
  };

  it("returns all findings for the all tab", () => {
    expect(findingsForGovernanceTab(report, "all")).toEqual(findings);
  });

  it("filters findings by pillar", () => {
    expect(findingsForGovernanceTab(report, "a11y")).toEqual([findings[0]]);
    expect(findingsForGovernanceTab(report, "code")).toEqual([findings[1]]);
    expect(findingsForGovernanceTab(report, "token")).toEqual([findings[2]]);
  });

  it("returns an empty list for the unused tab", () => {
    expect(findingsForGovernanceTab(report, "unused")).toEqual([]);
  });
});
