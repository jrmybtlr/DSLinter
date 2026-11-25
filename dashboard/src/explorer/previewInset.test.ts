import { describe, expect, it } from "vitest";
import { previewBleeds, previewPadding, type PreviewInsetNode } from "./previewInset";

function node(
  tagName: string,
  attrs: Record<string, string> = {},
  children: PreviewInsetNode[] = [],
): PreviewInsetNode {
  return {
    tagName,
    getAttribute: (name) => attrs[name] ?? null,
    children,
  };
}

describe("previewBleeds", () => {
  it("keeps buttons and inputs on the stage", () => {
    expect(previewBleeds(node("DIV", {}, [node("BUTTON")]))).toBe(false);
    expect(previewBleeds(node("DIV", {}, [node("INPUT")]))).toBe(false);
    expect(previewBleeds(node("BUTTON"))).toBe(false);
  });

  it("bleeds navigation, header, footer, and aside landmarks", () => {
    expect(previewBleeds(node("NAV"))).toBe(true);
    expect(previewBleeds(node("HEADER"))).toBe(true);
    expect(previewBleeds(node("FOOTER"))).toBe(true);
    expect(previewBleeds(node("ASIDE"))).toBe(true);
  });

  it("bleeds chrome roles and shell slots", () => {
    expect(previewBleeds(node("DIV", { role: "navigation" }))).toBe(true);
    expect(previewBleeds(node("DIV", { role: "menubar" }))).toBe(true);
    expect(previewBleeds(node("DIV", { role: "banner" }))).toBe(true);
    expect(previewBleeds(node("DIV", { "data-slot": "navigation-menu" }))).toBe(true);
    expect(previewBleeds(node("DIV", { "data-slot": "sidebar" }))).toBe(true);
    expect(previewBleeds(node("DIV", { "data-sidebar": "sidebar" }))).toBe(true);
  });

  it("unwraps a single-child provider shell to reach chrome", () => {
    expect(
      previewBleeds(node("DIV", {}, [node("DIV", {}, [node("NAV")])])),
    ).toBe(true);
    expect(
      previewBleeds(
        node("DIV", {}, [node("DIV", {}, [node("DIV", { "data-slot": "sidebar" })])]),
      ),
    ).toBe(true);
  });

  it("keeps breadcrumbs on the stage", () => {
    expect(previewBleeds(node("NAV", { "aria-label": "breadcrumb" }))).toBe(false);
    expect(previewBleeds(node("NAV", { "data-slot": "breadcrumb" }))).toBe(false);
    expect(
      previewBleeds(node("DIV", {}, [node("NAV", { "aria-label": "breadcrumb" })])),
    ).toBe(false);
  });

  it("keeps a mixed branch that includes a nav on the stage", () => {
    expect(
      previewBleeds(node("DIV", {}, [node("NAV"), node("BUTTON")])),
    ).toBe(false);
  });

  it("keeps empty or ordinary surfaces on the stage", () => {
    expect(previewBleeds(node("DIV"))).toBe(false);
    expect(previewBleeds(node("DIV", {}, [node("SPAN")]))).toBe(false);
  });
});

describe("previewPadding", () => {
  it("returns stage padding when the preview does not bleed", () => {
    expect(previewPadding(false, false)).toBe("64px");
    expect(previewPadding(true, false)).toBe("32px");
  });

  it("returns zero when the preview bleeds", () => {
    expect(previewPadding(false, true)).toBe("0");
    expect(previewPadding(true, true)).toBe("0");
  });
});
