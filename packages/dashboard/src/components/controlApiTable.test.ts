import { describe, expect, it } from "vitest";
import { controlsToApiRows } from "./controlApiTable";
import type { PlaygroundControl } from "../types/controls";

describe("controlsToApiRows", () => {
  it("does not expose generated example defaults as type badges", () => {
    const controls: PlaygroundControl[] = [
      {
        key: "children",
        label: "children",
        type: "string",
        default: "Example",
        defaultSource: "example",
      },
      {
        key: "variant",
        label: "variant",
        type: "string",
        default: "default",
        defaultSource: "type",
      },
    ];

    expect(controlsToApiRows(controls)).toMatchObject([
      { prop: "children", default: "\"Example\"", defaultBadge: null },
      { prop: "variant", default: "\"default\"", defaultBadge: "\"default\"" },
    ]);
  });
});
