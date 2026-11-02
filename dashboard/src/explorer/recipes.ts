import { familyRecipe, includesTarget } from "./familyRecipes";
import type { CatalogComponent, ExampleNode } from "../types/report";

export type DemoNode = {
  name: string;
  slot?: string;
  target?: boolean;
  props?: Record<string, unknown>;
  children?: (DemoNode | string)[];
};
const FAMILIES = [
  "Button",
  "Input",
  "Checkbox",
  "Switch",
  "Card",
  "Dialog",
  "Select",
  "Tabs",
  "Popover",
  "Tooltip",
];
const REQUIRED: Record<string, string[]> = {
  Card: ["Card", "CardHeader", "CardTitle", "CardContent"],
  Dialog: ["Dialog", "DialogTrigger", "DialogContent", "DialogTitle"],
  Select: ["Select", "SelectTrigger", "SelectContent", "SelectItem", "SelectValue"],
  Tabs: ["Tabs", "TabsList", "TabsTrigger", "TabsContent"],
  Popover: ["Popover", "PopoverTrigger", "PopoverContent"],
  Tooltip: ["Tooltip", "TooltipTrigger", "TooltipContent", "TooltipProvider"],
};

export function familyComponents(
  component: CatalogComponent,
  catalog: CatalogComponent[],
): CatalogComponent[] {
  const directory = component.preview.rel_path.split("/").slice(0, -1).join("/");
  return catalog.filter(
    (candidate) =>
      candidate.framework === component.framework &&
      (candidate.preview.rel_path === component.preview.rel_path ||
        candidate.preview.rel_path.split("/").slice(0, -1).join("/") === directory),
  );
}

function baseRecipeFor(
  component: CatalogComponent,
  catalog: CatalogComponent[],
): DemoNode | undefined {
  const family = FAMILIES.find(
    (name) =>
      component.name === name ||
      (component.name.startsWith(name) && /^[A-Z]/.test(component.name.slice(name.length))),
  );
  if (!family) return;
  const candidates = familyComponents(component, catalog);
  const names = new Set(candidates.map((candidate) => candidate.name));
  const contracts = candidates.filter(
    (candidate) =>
      candidate.name === family ||
      (candidate.name.startsWith(family) && /^[A-Z]/.test(candidate.name.slice(family.length))),
  );
  const knownPrimitive = contracts.some(
    (candidate) =>
      candidate.dependencies.some((dependency) =>
        /^(?:@radix-ui\/|radix-ui$|@base-ui\/|reka-ui$|radix-vue$|class-variance-authority$)/.test(
          dependency,
        ),
      ) ||
      (["Input", "Button"].includes(family) &&
        candidate.name === family &&
        candidate.preview.native_element === (family === "Input" ? "input" : "button")),
  );
  if (!(REQUIRED[family] || [family]).every((name) => names.has(name))) return;
  if (family !== "Card" && !knownPrimitive) return;
  const node = (
    name: string,
    children: (DemoNode | string)[] = [],
    props: Record<string, unknown> = {},
  ): DemoNode => ({ name, children, props });
  switch (family) {
    case "Button":
      return node("Button", ["Example button"]);
    case "Input":
      return node("Input", [], { placeholder: "Type something…", "aria-label": "Example input" });
    case "Checkbox":
      return node("Checkbox", [], { "aria-label": "Example checkbox" });
    case "Switch":
      return node("Switch", [], { "aria-label": "Example switch" });
    case "Card":
      return node("Card", [
        node("CardHeader", [node("CardTitle", ["Example card"])]),
        node("CardContent", ["Your component, styled by your application."]),
      ]);
    case "Dialog":
      return node("Dialog", [
        node("DialogTrigger", ["Open dialog"]),
        node("DialogContent", [
          node("DialogTitle", ["Example dialog"]),
          ...(names.has("DialogDescription")
            ? [node("DialogDescription", ["A generated example using your components."])]
            : []),
          ...(names.has("DialogClose") ? [node("DialogClose", ["Close"])] : []),
        ]),
      ]);
    case "Select":
      return node("Select", [
        node("SelectTrigger", [node("SelectValue", [], { placeholder: "Choose an option" })], {
          "aria-label": "Example select",
        }),
        node("SelectContent", [
          node("SelectItem", ["First option"], { value: "first" }),
          node("SelectItem", ["Second option"], { value: "second" }),
        ]),
      ]);
    case "Tabs":
      return node(
        "Tabs",
        [
          node("TabsList", [
            node("TabsTrigger", ["First"], { value: "first" }),
            node("TabsTrigger", ["Second"], { value: "second" }),
          ]),
          node("TabsContent", ["First panel"], { value: "first" }),
          node("TabsContent", ["Second panel"], { value: "second" }),
        ],
        { defaultValue: "first" },
      );
    case "Popover":
      return node("Popover", [
        node("PopoverTrigger", ["Open popover"]),
        node("PopoverContent", ["Example popover content"]),
      ]);
    case "Tooltip":
      return node(
        "TooltipProvider",
        [
          node(
            "Tooltip",
            [
              node("TooltipTrigger", ["Hover or focus here"]),
              node("TooltipContent", ["Example tooltip"]),
            ],
            { defaultOpen: component.name === "TooltipContent" },
          ),
        ],
        { delayDuration: 0 },
      );
  }
}

export function recipeFor(
  component: CatalogComponent,
  catalog: CatalogComponent[],
): DemoNode | undefined {
  const tree =
    familyRecipe(component, catalog) ||
    (component.name.startsWith("InputOTP") ? undefined : baseRecipeFor(component, catalog));
  if (!tree || !includesTarget(tree, new Set([component.name]))) return;
  let selected = false;
  function mark(node: DemoNode | string): void {
    if (typeof node === "string") return;
    if (node.name === component.name) {
      node.target = !selected;
      selected = true;
    }
    node.children?.forEach(mark);
  }
  mark(tree);
  return tree;
}

export function demoFromExample(tree: ExampleNode): DemoNode | string {
  if (tree.type === "text") return tree.value;
  if (tree.type === "placeholder") return tree.hint;
  return {
    name: tree.name,
    slot: tree.slot,
    props: Object.fromEntries(
      Object.entries(tree.props || {}).map(([key, value]) => [key, value.value]),
    ),
    children: tree.children?.map(demoFromExample),
  };
}

export function demoSnippet(
  tree: DemoNode | string,
  framework: "react" | "vue",
  depth = 0,
): string {
  if (typeof tree === "string") return "  ".repeat(depth) + tree;
  const props = Object.entries(tree.props || {})
    .filter(
      ([key, value]) =>
        !key.startsWith("on") &&
        !key.startsWith("slot:") &&
        value !== undefined &&
        typeof value !== "function",
    )
    .map(([key, value]) =>
      typeof value === "string"
        ? ` ${key}=${JSON.stringify(value)}`
        : framework === "vue"
          ? ` :${key}='${JSON.stringify(value)}'`
          : ` ${key}={${JSON.stringify(value)}}`,
    )
    .join("");
  const indent = "  ".repeat(depth);
  const children = [...(tree.children || [])];
  if (framework === "vue")
    for (const [key, value] of Object.entries(tree.props || {})) {
      if (!key.startsWith("slot:")) continue;
      const name = key.slice(5);
      if (name === "default") children.splice(0, children.length, String(value));
      else children.push({ name: `template #${name}`, children: [String(value)] });
    }
  const name = tree.slot ? `template #${tree.slot}` : tree.name;
  if (!children.length) return `${indent}<${name}${props} />`;
  return `${indent}<${name}${props}>\n${children.map((child) => demoSnippet(child, framework, depth + 1)).join("\n")}\n${indent}</${name.split(" ")[0]}>`;
}

export function demoWithValues(
  tree: DemoNode | string,
  targetNames: Set<string>,
  values: Record<string, unknown>,
): DemoNode | string {
  if (typeof tree === "string") return tree;
  const target = targetNames.has(tree.name) && tree.target !== false;
  const props = { ...tree.props, ...(target ? values : {}) };
  const children =
    target && typeof props.children === "string"
      ? [props.children]
      : tree.children?.map((child) => demoWithValues(child, targetNames, values));
  delete props.children;
  return { ...tree, props, children };
}
