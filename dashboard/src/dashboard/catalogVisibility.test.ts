import { describe, expect, it } from "vitest";
import type { WorkspaceReport } from "../types/report";
import {
  componentCatalogNamesFromReport,
  componentCatalogTreeFromReport,
} from "./aggregate";
import { isCatalogComponentHidden, pathMatchesPrefix, reportWithExtraHidden } from "./catalogVisibility";

function minimalReport(overrides: Partial<WorkspaceReport> = {}): WorkspaceReport {
  return {
    root: "/repo",
    files: [],
    findings: [],
    duplicate_components: [],
    usage_by_component: [],
    scores: {
      design_system_health: 0,
      ux_consistency: 0,
      accessibility: 0,
      maintainability: 0,
    },
    ...overrides,
  };
}

describe("catalogVisibility", () => {
  it("pathMatchesPrefix treats repo-relative paths", () => {
    expect(pathMatchesPrefix("resources/js/components/ui/button.tsx", "resources/js/components")).toBe(
      true,
    );
    expect(pathMatchesPrefix("resources/js/pages/foo.tsx", "resources/js/components")).toBe(false);
  });

  it("hides by component name from report config", () => {
    const report = minimalReport({
      config: { hidden_components: ["Secret"] },
      files: [
        {
          path: "resources/js/components/secret.tsx",
          definitions: [{ name: "Secret", kind: "function", line: 1 }],
          usages: [],
          parse_errors: [],
        },
        {
          path: "resources/js/components/button.tsx",
          definitions: [{ name: "Button", kind: "function", line: 1 }],
          usages: [],
          parse_errors: [],
        },
      ],
    });
    expect(isCatalogComponentHidden("Secret", report, ["resources/js/components/secret.tsx"])).toBe(
      true,
    );
    expect(componentCatalogNamesFromReport(report)).toEqual(["Button"]);
  });

  it("hides by path prefix", () => {
    const report = minimalReport({
      config: { hidden_paths: ["resources/js/components/legacy"] },
      files: [
        {
          path: "resources/js/components/legacy/old.tsx",
          definitions: [{ name: "Old", kind: "function", line: 1 }],
          usages: [],
          parse_errors: [],
        },
      ],
    });
    expect(componentCatalogNamesFromReport(report)).toEqual([]);
  });

  it("reportWithExtraHidden merges optimistic names", () => {
    const report = minimalReport({
      files: [
        {
          path: "a.tsx",
          definitions: [{ name: "A", kind: "function", line: 1 }],
          usages: [],
          parse_errors: [],
        },
        {
          path: "b.tsx",
          definitions: [{ name: "B", kind: "function", line: 1 }],
          usages: [],
          parse_errors: [],
        },
      ],
    });
    const merged = reportWithExtraHidden(report, ["B"]);
    expect(componentCatalogTreeFromReport(merged)).toEqual([{ type: "component", name: "A" }]);
  });
});
