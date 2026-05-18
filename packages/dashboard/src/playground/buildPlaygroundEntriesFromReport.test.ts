import { describe, expect, it } from "vitest";
import type { PlaygroundEntry } from "../types/playground";
import type { WorkspaceReport } from "../types/report";
import { resolvePlaygroundEntry } from "./buildPlaygroundEntriesFromReport";

const entries: PlaygroundEntry[] = [
  {
    id: "PrimaryButton",
    meta: { id: "PrimaryButton", title: "PrimaryButton" },
    modulePath: "@dslint-scan/src/components/PrimaryButton.tsx",
    controls: [],
    Preview: () => null,
  },
];

describe("resolvePlaygroundEntry", () => {
  it("finds by catalog export name id", () => {
    expect(resolvePlaygroundEntry(entries, "PrimaryButton")).toBe(entries[0]);
  });

  it("returns undefined for unknown name", () => {
    expect(resolvePlaygroundEntry(entries, "Missing")).toBeUndefined();
  });
});

describe("playground catalog id alignment", () => {
  it("report playgrounds use export_name as id", () => {
    const report: WorkspaceReport = {
      root: "/repo",
      files: [],
      findings: [],
      scores: {
        system_health: 0,
        token_adoption: 0,
        component_adoption: 0,
        ux_consistency: 0,
      },
      ownership: [],
      duplicate_components: [],
      usage_by_component: [],
      playgrounds: [
        {
          id: "Card",
          export_name: "Card",
          rel_path: "src/components/nested/DuplicateCardA.tsx",
          declared_props: [],
        },
      ],
    };
    expect(report.playgrounds?.[0]?.id).toBe("Card");
    expect(report.playgrounds?.[0]?.export_name).toBe("Card");
  });
});
