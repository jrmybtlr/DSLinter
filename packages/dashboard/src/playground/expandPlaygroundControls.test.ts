import { describe, expect, it } from "vitest";
import { expandPlaygroundControls, propsFromControls } from "./expandPlaygroundControls";

describe("expandPlaygroundControls", () => {
  it("expands string shorthand to string controls", () => {
    const controls = expandPlaygroundControls({ title: "Hello" });
    expect(controls).toEqual([
      { key: "title", label: "Title", type: "string", default: "Hello" },
    ]);
  });

  it("expands prop key list with prop-name defaults", () => {
    const controls = expandPlaygroundControls(["title", "description"]);
    expect(controls).toEqual([
      {
        key: "title",
        label: "Title",
        type: "string",
        default: "title",
        defaultSource: "example",
        placeholder: "title",
      },
      {
        key: "description",
        label: "Description",
        type: "string",
        default: "description",
        defaultSource: "example",
        placeholder: "description",
      },
    ]);
    expect(propsFromControls(controls, {})).toEqual({
      title: "title",
      description: "description",
    });
  });

  it("propsFromControls uses control defaults", () => {
    const controls = expandPlaygroundControls({ count: 2, enabled: true });
    expect(propsFromControls(controls, {})).toEqual({ count: 2, enabled: true });
    expect(propsFromControls(controls, { count: 5 })).toEqual({ count: 5, enabled: true });
  });
});
