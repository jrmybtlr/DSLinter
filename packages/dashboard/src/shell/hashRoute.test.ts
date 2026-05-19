import { describe, expect, it } from "vitest";
import { formatHashRoute, parseHashRoute } from "./hashRoute";

describe("parseHashRoute", () => {
  it("parses governance overview", () => {
    expect(parseHashRoute("#!/governance")).toEqual({ view: "governance" });
    expect(parseHashRoute("")).toEqual({ view: "governance" });
  });

  it("parses legacy governance catalog deep link as component route", () => {
    expect(parseHashRoute("#!/governance/ActionItem")).toEqual({
      view: "component",
      componentId: "ActionItem",
    });
  });

  it("parses component route", () => {
    expect(parseHashRoute("#!/component/ActionItem")).toEqual({
      view: "component",
      componentId: "ActionItem",
    });
  });

  it("parses tokens", () => {
    expect(parseHashRoute("#!/tokens")).toEqual({ view: "tokens" });
  });
});

describe("formatHashRoute", () => {
  it("formats component route", () => {
    expect(
      formatHashRoute({ view: "component", componentId: "ActionItem" }),
    ).toBe("#!/component/ActionItem");
  });

  it("formats governance catalog", () => {
    expect(
      formatHashRoute({ view: "governance", catalog: "ActionItem" }),
    ).toBe("#!/governance/ActionItem");
  });
});
