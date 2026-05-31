import { describe, expect, it } from "vitest";
import type { WorkspaceReport } from "../types/report";
import { defaultConsumerGlobKeyFromRelPath, diagnosePlaygroundJoinSkips } from "./playgroundJoin";
import { buildPlaygroundEntriesFromReportWithSkips } from "./buildPlaygroundEntriesFromReport";

describe("defaultConsumerGlobKeyFromRelPath", () => {
  it("maps nested ui paths for src/playground registry", () => {
    expect(defaultConsumerGlobKeyFromRelPath("src/components/ui/button.tsx")).toBe(
      "../components/ui/button.tsx",
    );
  });

  it("maps flat component paths", () => {
    expect(defaultConsumerGlobKeyFromRelPath("src/components/Button.tsx")).toBe(
      "../components/Button.tsx",
    );
  });

  it("maps Laravel resources/js paths", () => {
    expect(defaultConsumerGlobKeyFromRelPath("resources/js/Components/Icons/Activity.tsx")).toBe(
      "../Components/Icons/Activity.tsx",
    );
  });
});

describe("diagnosePlaygroundJoinSkips", () => {
  const report: WorkspaceReport = {
    root: "/repo",
    files: [],
    findings: [],
    scores: {
      design_system_health: 0,
      ux_consistency: 0,
      accessibility: 0,
      maintainability: 0,
    },
    ownership: [],
    duplicate_components: [],
    usage_by_component: [],
    playgrounds: [
      {
        id: "Button",
        export_name: "Button",
        rel_path: "src/components/ui/button.tsx",
        declared_props: [],
      },
    ],
  };

  it("flags module_not_found when glob key is missing", () => {
    const skipped = diagnosePlaygroundJoinSkips(
      report,
      {},
      {
        globKeyFromRelPath: defaultConsumerGlobKeyFromRelPath,
      },
    );
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.reason).toBe("module_not_found");
    expect(skipped[0]?.globKey).toBe("../components/ui/button.tsx");
  });

  it("joins when module and export exist", () => {
    const key = defaultConsumerGlobKeyFromRelPath("src/components/ui/button.tsx");
    const modules = {
      [key]: {
        Button: function Button() {
          return null;
        },
      },
    };
    const { entries, skipped } = buildPlaygroundEntriesFromReportWithSkips(report, modules, {
      globKeyFromRelPath: defaultConsumerGlobKeyFromRelPath,
      logJoinSkips: false,
    });
    expect(skipped).toHaveLength(0);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("Button");
  });

  it("joins bare rel_path via unique suffix when subdirectory scan shortened the path", () => {
    const subdirReport: WorkspaceReport = {
      ...report,
      playgrounds: [
        {
          id: "Button",
          export_name: "Button",
          rel_path: "Button.tsx",
          declared_props: [],
        },
      ],
    };
    const modules = {
      "../Components/Button.tsx": {
        Button: function Button() {
          return null;
        },
      },
    };
    const { entries, skipped } = buildPlaygroundEntriesFromReportWithSkips(subdirReport, modules, {
      globKeyFromRelPath: defaultConsumerGlobKeyFromRelPath,
      logJoinSkips: false,
    });
    expect(skipped).toHaveLength(0);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.modulePath).toBe("../Components/Button.tsx");
  });
});
