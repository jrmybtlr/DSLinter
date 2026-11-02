import { expect, it } from "vitest";
import type { CatalogComponent } from "../types/report";
import { controlsForComponent, propsForPreview } from "./componentControls";
import { defaultArgsFromControls } from "../types/controls";

it("keeps structured samples and omits untouched optional controls", () => {
  const items = [{ title: "Home", href: "/" }];
  const component: CatalogComponent = {
    id: "Nav#Nav",
    name: "Nav",
    framework: "react",
    bindings: {},
    dependencies: [],
    usages: [],
    preview: {
      id: "Nav",
      rel_path: "Nav.tsx",
      export_name: "Nav",
      declared_props: ["items", "showLabel", "label"],
      declared_prop_kinds: { items: "object", showLabel: "boolean", label: "string" },
      declared_prop_optional: { showLabel: true, label: true },
      sample_props: { items },
    },
  };
  const controls = controlsForComponent(component, [component]);
  const values = defaultArgsFromControls(controls);
  expect(controls.find((control) => control.key === "items")?.type).toBe("object");
  expect(propsForPreview(component, controls, values, { items }, new Set())).toEqual({ items });
  expect(
    propsForPreview(
      component,
      controls,
      { ...values, showLabel: false, label: "" },
      { items },
      new Set(["showLabel", "label"]),
    ),
  ).toEqual({ items, showLabel: false, label: "" });
});
