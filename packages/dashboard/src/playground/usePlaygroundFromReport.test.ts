import { describe, expect, it } from "vitest";
import { embedGlobKeyFromRelPath } from "../../vite/collectScanModules";
import { buildPlaygroundEntriesFromReportWithSkips } from "./buildPlaygroundEntriesFromReport";

describe("autoPlayground join (embed glob keys)", () => {
  it("joins report playgrounds to virtual module keys", () => {
    const relPath =
      "resources/js/Components/Billing/AdditionalEventLimitModal.tsx";
    const globKey = embedGlobKeyFromRelPath(relPath);
    const modules = {
      [globKey]: {
        AdditionalEventLimitModal: function AdditionalEventLimitModal() {
          return null;
        },
      },
    };
    const report = {
      playgrounds: [
        {
          id: "AdditionalEventLimitModal",
          export_name: "AdditionalEventLimitModal",
          rel_path: relPath,
        },
      ],
    };

    const { entries, skipped } = buildPlaygroundEntriesFromReportWithSkips(
      report,
      modules,
      { logJoinSkips: false },
    );

    expect(skipped).toHaveLength(0);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.modulePath).toBe(globKey);
  });
});
