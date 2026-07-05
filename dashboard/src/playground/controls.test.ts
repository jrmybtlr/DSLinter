import { describe, expect, it } from "vitest";
import { controlsFromDeclaredProps } from "./controls";

describe("controlsFromDeclaredProps", () => {
  it("uses a readable default for stringArray errors props", () => {
    const controls = controlsFromDeclaredProps(
      ["errors", "title"],
      { errors: "stringArray", title: "string" },
    );
    const errorsControl = controls.find((c) => c.key === "errors");
    expect(errorsControl?.type).toBe("string");
    if (errorsControl?.type === "string") {
      expect(errorsControl.default).toBe("Something went wrong.");
      expect(errorsControl.placeholder).toBe("One item per line");
    }
  });
});
