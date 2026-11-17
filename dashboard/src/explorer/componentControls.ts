import type { CatalogComponent } from "../types/report";
import { valuesToComponentProps } from "../playground/propCoerce";
import type { PlaygroundArgs } from "../types/controls";
import type { PlaygroundControl } from "../types/controls";
import { controlsForSpec } from "../playground/controls";
import { recipeFor, demoFromExample, type DemoNode } from "./recipes";

export function controlsForComponent(
  component: CatalogComponent,
  catalog: CatalogComponent[],
): PlaygroundControl[] {
  const spec = component.preview;
  const controls = controlsForSpec(
    component.id,
    spec.declared_props,
    spec.declared_prop_kinds,
    spec.declared_prop_options,
    spec.declared_prop_defaults,
    {},
    component.name,
    spec.declared_prop_optional,
    spec.declared_prop_type_labels,
  );
  const recipe = component.preview.example_tree
    ? demoFromExample(component.preview.example_tree)
    : recipeFor(component, catalog);
  function findTarget(node: DemoNode | string): DemoNode | undefined {
    if (typeof node === "string") return;
    if (node.name === component.name || component.bindings[node.name] === component.id) return node;
    return node.children?.map(findTarget).find(Boolean);
  }
  const target = recipe && typeof recipe !== "string" ? findTarget(recipe) : undefined;
  const composed = target?.children?.some((child) => typeof child !== "string");
  const label = target?.children?.filter((child) => typeof child === "string").join("");
  for (const control of controls) {
    const value = target?.props?.[control.key];
    if (value !== undefined && typeof value === typeof control.default)
      control.default = value as string | number | boolean;
    if (control.key === "children" && label) control.default = label;
  }
  for (const slot of spec.slots || []) {
    if (slot === "default" && composed) continue;
    controls.push({
      key: `slot:${slot}`,
      label: `Slot: ${slot}`,
      type: "string",
      default: slot === "default" && label ? label : `Example ${slot}`,
    });
  }
  return composed ? controls.filter((control) => control.key !== "children") : controls;
}

export function propsForPreview(
  component: CatalogComponent,
  controls: PlaygroundControl[],
  args: PlaygroundArgs,
  fixtures: Record<string, unknown>,
  explicitKeys: Set<string>,
): Record<string, unknown> {
  const props = valuesToComponentProps(
    controls,
    component.preview.declared_props,
    args,
    component.preview.declared_prop_kinds,
    component.name,
  );
  return {
    ...fixtures,
    ...Object.fromEntries(
      Object.entries(props).filter(
        ([key]) =>
          explicitKeys.has(key) ||
          !component.preview.declared_prop_optional?.[key] ||
          key.startsWith("slot:") ||
          component.preview.declared_prop_defaults?.[key] !== undefined,
      ),
    ),
  };
}
