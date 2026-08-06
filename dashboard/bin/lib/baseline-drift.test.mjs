import { describe, expect, it } from "vitest";
import {
  computeDrift,
  evaluateDriftFailure,
  extractDriftFlags,
} from "./baseline-drift.mjs";

describe("baseline-drift", () => {
  it("extracts drift flags from scanner args", () => {
    const out = extractDriftFlags([
      ".",
      "--json",
      "--fail-on-drift",
      "--max-finding-delta",
      "3",
      "--update-baseline",
    ]);
    expect(out.failOnDrift).toBe(true);
    expect(out.updateBaseline).toBe(true);
    expect(out.maxFindingDelta).toBe(3);
    expect(out.scannerArgs).toEqual([".", "--json"]);
  });

  it("fails when findings increase", () => {
    const drift = computeDrift(
      {
        scores: {
          design_system_health: 80,
          ux_consistency: 80,
          accessibility: 80,
          maintainability: 80,
        },
        findings: [{}, {}],
      },
      {
        hash: "x",
        saved_at: "2020-01-01T00:00:00Z",
        scores: {
          design_system_health: 80,
          ux_consistency: 80,
          accessibility: 80,
          maintainability: 80,
        },
        finding_count: 1,
      },
    );
    expect(drift.finding_delta).toBe(1);
    const result = evaluateDriftFailure(drift, { maxFindingDelta: 0 });
    expect(result.ok).toBe(false);
  });

  it("passes when within max-finding-delta", () => {
    const drift = computeDrift(
      {
        scores: {
          design_system_health: 90,
          ux_consistency: 90,
          accessibility: 90,
          maintainability: 90,
          token_adoption: 70,
        },
        findings: [{}],
      },
      {
        hash: "x",
        saved_at: "2020-01-01T00:00:00Z",
        scores: {
          design_system_health: 90,
          ux_consistency: 90,
          accessibility: 90,
          maintainability: 90,
          token_adoption: 70,
        },
        finding_count: 1,
      },
    );
    expect(evaluateDriftFailure(drift).ok).toBe(true);
  });
});
