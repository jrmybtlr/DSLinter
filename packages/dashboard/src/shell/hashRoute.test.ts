import { describe, expect, it } from "vitest";
import { formatHashRoute, parseHashRoute } from "./hashRoute";

describe("parseHashRoute", () => {
  it("parses governance overview", () => {
    expect(parseHashRoute("/governance")).toEqual({ view: "governance" });
    expect(parseHashRoute("/")).toEqual({ view: "governance" });
    expect(parseHashRoute("")).toEqual({ view: "governance" });
  });

  it("parses component route", () => {
    expect(parseHashRoute("/component/ActionItem")).toEqual({
      view: "component",
      componentId: "ActionItem",
    });
  });

  it("parses tokens", () => {
    expect(parseHashRoute("/tokens")).toEqual({ view: "tokens" });
  });

  it("parses catalog", () => {
    expect(parseHashRoute("/catalog")).toEqual({ view: "catalog" });
    expect(parseHashRoute("/governance/catalog")).toEqual({ view: "catalog" });
  });
});

describe("formatHashRoute", () => {
  it("formats component route", () => {
    expect(
      formatHashRoute({ view: "component", componentId: "ActionItem" }),
    ).toBe("/component/ActionItem");
  });

  it("formats governance", () => {
    expect(formatHashRoute({ view: "governance" })).toBe("/governance");
  });

  it("formats catalog", () => {
    expect(formatHashRoute({ view: "catalog" })).toBe("/catalog");
  });
});
