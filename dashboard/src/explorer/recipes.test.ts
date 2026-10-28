import { describe, expect, it } from "vitest";
import { demoSnippet, demoWithValues, recipeFor } from "./recipes";
import type { CatalogComponent } from "../types/report";

function catalog(
  names: string[],
  dependency: string,
  framework: "react" | "vue" = "react",
): CatalogComponent[] {
  return names.map((name) => ({
    id: `ui/${name}#default`,
    name,
    framework,
    preview: {
      id: name,
      rel_path: `ui/${name}.${framework === "vue" ? "vue" : "tsx"}`,
      export_name: "default",
      declared_props: [],
    },
    usages: [],
    bindings: {},
    dependencies: [dependency],
  }));
}

describe("composition recipes", () => {
  it.each(["@radix-ui/react-dialog", "@base-ui/react/dialog", "reka-ui"])(
    "preserves dialog composition for %s",
    (dependency) => {
      const components = catalog(
        [
          "Dialog",
          "DialogTrigger",
          "DialogContent",
          "DialogTitle",
          "DialogDescription",
          "DialogClose",
        ],
        dependency,
        dependency === "reka-ui" ? "vue" : "react",
      );
      const tree = recipeFor(components[0], components)!;
      const snippet = demoSnippet(tree, components[0].framework);
      expect(snippet).toContain("<DialogTrigger>");
      expect(snippet).toContain("<DialogTitle>");
      expect(snippet).toContain("<DialogClose>");
    },
  );
  it("rejects incomplete compound contracts instead of guessing missing exports", () => {
    const components = catalog(["Dialog", "DialogTrigger"], "reka-ui", "vue");
    expect(recipeFor(components[0], components)).toBeUndefined();
  });
  it("does not borrow an unrelated component's primitive contract", () => {
    const components = [...catalog(["Button"], "./custom"), ...catalog(["Dialog"], "reka-ui")];
    expect(recipeFor(components[0], components)).toBeUndefined();
  });
  it.each([
    "Button",
    "Input",
    "Checkbox",
    "Switch",
    "Card",
    "Select",
    "Tabs",
    "Popover",
    "Tooltip",
  ])("constructs a complete %s example", (name) => {
    const roles: Record<string, string[]> = {
      Card: ["CardHeader", "CardTitle", "CardContent"],
      Select: ["SelectTrigger", "SelectContent", "SelectItem", "SelectValue"],
      Tabs: ["TabsList", "TabsTrigger", "TabsContent"],
      Popover: ["PopoverTrigger", "PopoverContent"],
      Tooltip: ["TooltipTrigger", "TooltipContent", "TooltipProvider"],
    };
    for (const framework of ["react", "vue"] as const) {
      const components = catalog(
        [name, ...(roles[name] || [])],
        framework === "react" ? "@radix-ui/react-slot" : "reka-ui",
        framework,
      );
      expect(recipeFor(components[0], components)).toBeDefined();
    }
  });
  it("generates updated React props and Vue slots for copying", () => {
    const tree = demoWithValues({ name: "Button", children: ["Old"] }, new Set(["Button"]), {
      children: "New",
      disabled: true,
    });
    expect(demoSnippet(tree, "react")).toContain("disabled={true}");
    expect(demoSnippet(tree, "react")).toContain("New");
    const vue = demoWithValues({ name: "Card" }, new Set(["Card"]), { "slot:footer": "Footer" });
    expect(demoSnippet(vue, "vue")).toContain("<template #footer>");
    expect(demoSnippet(vue, "vue")).not.toContain("</template #footer>");
  });
});
