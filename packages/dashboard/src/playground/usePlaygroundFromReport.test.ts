import { describe, expect, it } from "vitest";
import { embedGlobKeyFromRelPath } from "../../vite/collectScanModules";
import type { WorkspaceReport } from "../types/report";
import { buildPlaygroundEntriesFromReportWithSkips } from "./buildPlaygroundEntriesFromReport";

describe("autoPlayground join (embed glob keys)", () => {
  it("joins report playgrounds to virtual module keys", () => {
    const relPath = "resources/js/Components/Billing/AdditionalEventLimitModal.tsx";
    const globKey = embedGlobKeyFromRelPath(relPath);
    const modules = {
      [globKey]: {
        AdditionalEventLimitModal: function AdditionalEventLimitModal() {
          return null;
        },
      },
    };
    const report: WorkspaceReport = {
      root: "/repo",
      files: [],
      findings: [],
      duplicate_components: [],
      usage_by_component: [],
      ownership: [],
      scores: {
        design_system_health: 0,
        ux_consistency: 0,
        accessibility: 0,
        maintainability: 0,
      },
      playgrounds: [
        {
          id: "AdditionalEventLimitModal",
          export_name: "AdditionalEventLimitModal",
          rel_path: relPath,
          declared_props: [],
        },
      ],
    };

    const { entries, skipped } = buildPlaygroundEntriesFromReportWithSkips(report, modules, {
      logJoinSkips: false,
    });

    expect(skipped).toHaveLength(0);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.modulePath).toBe(globKey);
  });
});
