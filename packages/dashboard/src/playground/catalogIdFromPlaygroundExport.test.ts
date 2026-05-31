import { describe, expect, it } from "vitest";
import { catalogIdFromPlaygroundExport } from "./catalogIdFromPlaygroundExport";

describe("catalogIdFromPlaygroundExport", () => {
  it("maps *Playground export names to PascalCase catalog ids", () => {
    expect(catalogIdFromPlaygroundExport("alertPlayground")).toBe("Alert");
    expect(catalogIdFromPlaygroundExport("toggleGroupPlayground")).toBe("ToggleGroup");
    expect(catalogIdFromPlaygroundExport("dropdownMenuPlayground")).toBe("DropdownMenu");
  });

  it("returns undefined for non-playground export names", () => {
    expect(catalogIdFromPlaygroundExport("Alert")).toBeUndefined();
    expect(catalogIdFromPlaygroundExport("playground")).toBeUndefined();
  });
});
