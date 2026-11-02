import { expect, it } from "vitest";
import type { CatalogComponent, WorkspaceReport } from "../types/report";
import {
  catalogLabels,
  catalogNavigation,
  componentUsage,
  dashboardReport,
} from "./dashboardReport";
import {
  aggregateDeclaredProps,
  unusedComponentsFromReport,
  usageMap,
} from "../dashboard/aggregate";
import { codeScoreSummaryForModule } from "../report/codeScoreForModule";

function component(name: string, path: string, used = false): CatalogComponent {
  return {
    id: `${path}#${name}`,
    name,
    framework: path.endsWith(".vue") ? "vue" : "react",
    preview: { id: name, rel_path: path, export_name: name, declared_props: ["label", "disabled"] },
    dependencies: [],
    bindings: {},
    usages: used
      ? [{ path: "/workspace/Page.tsx", line: 7, props: ["label"], prop_values: { label: "Save" } }]
      : [],
  };
}
function report(catalog: CatalogComponent[]): WorkspaceReport {
  const paths = [...new Set(catalog.map((item) => item.preview.rel_path))];
  return {
    root: "/workspace",
    components: catalog,
    files: paths.map((path) => ({
      path: `/workspace/${path}`,
      parse_errors: [],
      definitions: catalog
        .filter((item) => item.preview.rel_path === path)
        .map((item) => ({ name: item.name, kind: "export_default_anonymous" as const, line: 2 })),
    })),
    findings: [],
    usage_by_component: [],
    duplicate_components: [],
    scores: {
      design_system_health: 100,
      ux_consistency: 100,
      accessibility: 100,
      maintainability: 100,
    },
  };
}

it("restores analytics widgets without merging identically named components", () => {
  const a = component("Button", "a/Button.tsx", true);
  const b = component("Button", "b/Button.vue");
  const input = report([a, b]);
  const view = dashboardReport(input, [a, b]);
  expect(usageMap(view).get(a.id)?.reference_count).toBe(1);
  expect(usageMap(view).get(b.id)?.reference_count).toBe(0);
  expect(unusedComponentsFromReport(view).map((item) => item.name)).toEqual([b.id]);
  expect(aggregateDeclaredProps(view).get(b.id)).toEqual(["label", "disabled"]);
  expect(componentUsage(a).prop_value_frequencies).toEqual({ label: { Save: 1 } });
  expect(input.files[0].definitions[0].name).toBe("Button");
  expect(input.usage_by_component).toEqual([]);
});

it("keeps Vue compound families together while separating app contexts", () => {
  const catalog = [
    component("Dialog", "a/Dialog.vue"),
    component("DialogTrigger", "a/DialogTrigger.vue"),
    component("DialogContent", "a/DialogContent.vue"),
    component("Dialog", "b/Dialog.vue"),
    component("DialogTrigger", "b/DialogTrigger.vue"),
  ];
  const tree = catalogNavigation(catalog);
  expect(tree).toHaveLength(2);
  const family = tree.find((item) => item.type === "family" && item.parent === catalog[0].id);
  expect(family?.type === "family" && family.children).toEqual(
    expect.arrayContaining(catalog.slice(0, 3).map((item) => item.id)),
  );
  expect(catalogLabels(catalog)[catalog[0].id].description).toBe("a/Dialog.vue");
});

it("does not group duplicate declarations in the same directory into a single component", () => {
  const a = component("Card", "ui/CardA.tsx");
  const b = component("Card", "ui/CardB.tsx");
  expect(catalogNavigation([a, b])).toEqual([
    { type: "component", name: a.id },
    { type: "component", name: b.id },
  ]);
});

it("retains same-file subcomponents even when their names do not share a prefix", () => {
  const button = component("Button", "ui/button.tsx");
  const icon = component("IconButton", "ui/button.tsx");
  expect(catalogNavigation([button, icon])).toEqual([
    { type: "family", parent: button.id, path: "ui/Button", children: [button.id, icon.id] },
  ]);
});

it("component code gauges include the scanner's current code rule names", () => {
  const data = report([]);
  data.findings = [
    {
      rule_id: "code-debugger",
      path: "/workspace/Bad.tsx",
      line: 4,
      severity: "warning",
      message: "debugger",
    },
    {
      rule_id: "a11y-button-name",
      path: "/workspace/Bad.tsx",
      line: 5,
      severity: "warning",
      message: "label",
    },
    {
      rule_id: "code-console",
      path: "/workspace/Other.tsx",
      line: 1,
      severity: "info",
      message: "console",
    },
  ];
  expect(codeScoreSummaryForModule(data, "Bad.tsx")).toMatchObject({ score: 90, issueCount: 1 });
});
