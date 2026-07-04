import { describe, expect, it } from "vitest";
import type { ExampleNode, PlaygroundSpec, WorkspaceReport } from "../types/report";
import {
  nestedComponentNamesInTree,
  shouldUseExampleTreePreview,
} from "./shouldUseExampleTreePreview";

const el = (
  name: string,
  children: ExampleNode[] = [],
): ExampleNode => ({ type: "element", name, children });

const report: WorkspaceReport = {
  root: "/repo",
  files: [
    {
      path: "/repo/resources/js/components/ui/button.tsx",
      definitions: [{ name: "Button", kind: "function", line: 1 }],
      parse_errors: [],
    },
    {
      path: "/repo/resources/js/components/ui/alert.tsx",
      definitions: [
        { name: "Alert", kind: "function", line: 1 },
        { name: "AlertTitle", kind: "function", line: 2 },
      ],
      parse_errors: [],
    },
    {
      path: "/repo/resources/js/components/ui/breadcrumb.tsx",
      definitions: [
        { name: "Breadcrumb", kind: "function", line: 1 },
        { name: "BreadcrumbList", kind: "function", line: 2 },
      ],
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

describe("shouldUseExampleTreePreview", () => {
  it("returns false without example tree", () => {
    const spec: PlaygroundSpec = {
      id: "Button",
      export_name: "Button",
      rel_path: "resources/js/components/ui/button.tsx",
      declared_props: ["variant"],
      declared_prop_options: { variant: ["default", "ghost"] },
    };
    expect(shouldUseExampleTreePreview(spec, undefined, report)).toBe(false);
  });

  it("prefers live render for CVA leaf with external-only nested usage", () => {
    const tree = el("Button", [el("Avatar", [el("AvatarImage")])]);
    const spec: PlaygroundSpec = {
      id: "Button",
      export_name: "Button",
      rel_path: "resources/js/components/ui/button.tsx",
      declared_props: ["variant", "size"],
      declared_prop_options: {
        variant: ["default", "ghost"],
        size: ["default", "sm"],
      },
      example_tree: tree,
    };
    expect(shouldUseExampleTreePreview(spec, tree, report)).toBe(false);
    expect(nestedComponentNamesInTree(tree, "Button")).toEqual([
      "Avatar",
      "AvatarImage",
    ]);
  });

  it("keeps example tree for same-module compound kits", () => {
    const tree = el("Alert", [el("AlertTitle", [{ type: "text", value: "x" }])]);
    const spec: PlaygroundSpec = {
      id: "Alert",
      export_name: "Alert",
      rel_path: "resources/js/components/ui/alert.tsx",
      declared_props: ["variant"],
      declared_prop_options: { variant: ["default", "destructive"] },
      example_tree: tree,
    };
    expect(shouldUseExampleTreePreview(spec, tree, report)).toBe(true);
  });

  it("keeps example tree for breadcrumb-style same-file composition", () => {
    const tree = el("Breadcrumb", [el("BreadcrumbList", [el("BreadcrumbItem")])]);
    const spec: PlaygroundSpec = {
      id: "Breadcrumb",
      export_name: "Breadcrumb",
      rel_path: "resources/js/components/ui/breadcrumb.tsx",
      declared_props: [],
      example_tree: tree,
    };
    expect(shouldUseExampleTreePreview(spec, tree, report)).toBe(true);
  });
});
