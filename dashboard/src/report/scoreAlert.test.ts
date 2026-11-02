import { expect, it } from "vitest";
import type { WorkspaceReport } from "../types/report";
import { scoreAlertLevel, scoreAlertsByComponent, worstScoreAlert } from "./scoreAlert";

const scores = {
  design_system_health: 0,
  ux_consistency: 0,
  accessibility: 0,
  maintainability: 0,
};

it("bands scores at 100, 90, and 70", () => {
  expect(scoreAlertLevel(100)).toBeNull();
  expect(scoreAlertLevel(99)).toBe("muted");
  expect(scoreAlertLevel(90)).toBe("muted");
  expect(scoreAlertLevel(89)).toBe("warning");
  expect(scoreAlertLevel(70)).toBe("warning");
  expect(scoreAlertLevel(69)).toBe("critical");
  expect(worstScoreAlert(["muted", "warning", null])).toBe("warning");
  expect(worstScoreAlert(["warning", "critical"])).toBe("critical");
});

it("marks components from code and accessibility findings on their file", () => {
  const report: WorkspaceReport = {
    root: "/repo",
    files: [
      {
        path: "/repo/resources/js/components/ui/sidebar.tsx",
        definitions: [{ name: "resources/js/components/ui/sidebar.tsx#Sidebar", kind: "function", line: 1 }],
        parse_errors: [],
      },
      {
        path: "/repo/resources/js/components/ui/button.tsx",
        definitions: [{ name: "resources/js/components/ui/button.tsx#Button", kind: "function", line: 1 }],
        parse_errors: [],
      },
    ],
    findings: [
      {
        rule_id: "code-large-file",
        path: "/repo/resources/js/components/ui/sidebar.tsx",
        line: null,
        severity: "info",
        message: "large",
      },
      {
        rule_id: "a11y-button-name",
        path: "/repo/resources/js/components/ui/button.tsx",
        line: 4,
        severity: "error",
        message: "name",
      },
      {
        rule_id: "a11y-button-name",
        path: "/repo/resources/js/components/ui/button.tsx",
        line: 8,
        severity: "error",
        message: "name",
      },
    ],
    scores,
    duplicate_components: [],
    usage_by_component: [],
  };

  const alerts = scoreAlertsByComponent(report);
  expect(alerts.get("resources/js/components/ui/sidebar.tsx#Sidebar")).toBe("muted");
  expect(alerts.get("resources/js/components/ui/button.tsx#Button")).toBe("critical");
});
