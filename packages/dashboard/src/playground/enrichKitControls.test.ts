import { describe, expect, it } from "vitest";
import { enrichControlsFromKitJsx } from "./enrichKitControls";
import { expandPlaygroundControls } from "./expandPlaygroundControls";

describe("enrichControlsFromKitJsx", () => {
  it("labels slot params from compound subcomponents", () => {
    const controls = expandPlaygroundControls({ title: "title", description: "description" });
    const enriched = enrichControlsFromKitJsx(controls, [
      { component: "AlertTitle", param: "title" },
      { component: "AlertDescription", param: "description" },
    ]);
    expect(enriched[0]).toMatchObject({
      key: "title",
      label: "Title",
      default: "Heads up",
      hint: "AlertTitle children",
    });
    expect(enriched[1]).toMatchObject({
      key: "description",
      label: "Description",
      default: "This is a short description.",
      hint: "AlertDescription children",
    });
  });
});
