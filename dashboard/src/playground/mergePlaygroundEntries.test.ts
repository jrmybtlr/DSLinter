import { describe, expect, it } from "vitest";
import type { PlaygroundEntry } from "../types/playground";
import { mergePlaygroundEntries } from "./mergePlaygroundEntries";

function entry(id: string, title = id, group?: string): PlaygroundEntry {
  return {
    id,
    meta: { id, title, ...(group ? { group } : {}) },
    modulePath: `../components/${id}.tsx`,
    controls: [],
    renderPreview: () => null,
    Preview: () => null,
  };
}

describe("mergePlaygroundEntries", () => {
  it("manual entries override auto entries with the same id", () => {
    const auto = [entry("DropdownMenu", "DropdownMenu-auto")];
    const manual = [entry("DropdownMenu", "DropdownMenu-manual", "ui")];
    const merged = mergePlaygroundEntries(auto, manual);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.meta.title).toBe("DropdownMenu-manual");
    expect(merged[0]?.meta.group).toBe("ui");
  });

  it("merges distinct entries and sorts by group then title", () => {
    const auto = [entry("Button"), entry("Input", "Input", "forms")];
    const manual = [entry("Dialog", "Dialog", "ui")];
    const merged = mergePlaygroundEntries(auto, manual);
    expect(merged.map((e) => e.id)).toEqual(["Button", "Input", "Dialog"]);
  });
});
