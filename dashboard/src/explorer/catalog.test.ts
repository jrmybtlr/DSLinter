import { describe, expect, it } from "vitest";
import { catalogFromReport, resolveCatalogComponent } from "./catalog";
import type { WorkspaceReport } from "../types/report";

const report: WorkspaceReport = {
  root: "/app",
  files: [
    {
      path: "/app/a/Button.tsx",
      definitions: [{ name: "Button", kind: "function", line: 1 }],
      parse_errors: [],
    },
    {
      path: "/app/b/Button.tsx",
      definitions: [{ name: "Button", kind: "function", line: 1 }],
      parse_errors: [],
    },
  ],
  findings: [],
  duplicate_components: [],
  usage_by_component: [
    {
      component: "Button",
      reference_count: 3,
      file_count: 1,
      max_props_on_single_use: 0,
      files: ["Page.tsx"],
      usage_locations: [{ path: "Page.tsx", line: 1, props: [] }],
    },
  ],
  scores: {
    design_system_health: 100,
    ux_consistency: 100,
    accessibility: 100,
    maintainability: 100,
  },
};

describe("catalog compatibility", () => {
  it("keeps same-named v3 definitions separate without attributing ambiguous usages", () => {
    const components = catalogFromReport(report);
    expect(components.map((component) => component.id)).toEqual([
      "a/Button.tsx#Button",
      "b/Button.tsx#Button",
    ]);
    expect(
      components.every((component) => component.legacy_ambiguous && component.usages.length === 0),
    ).toBe(true);
    expect(() => resolveCatalogComponent(report, "Button")).toThrow("Ambiguous component Button");
    expect(resolveCatalogComponent(report, "b/Button.tsx#Button")?.preview.rel_path).toBe(
      "b/Button.tsx",
    );
  });
});
