import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlaygroundEntry } from "../types/playground";
import type { WorkspaceReport } from "../types/report";
import { defaultArgsFromControls, type PlaygroundControl } from "../types/controls";
import {
  buildPlaygroundEntriesFromReportWithSkips,
  resolvePlaygroundEntry,
} from "./buildPlaygroundEntriesFromReport";
import { definePlayground } from "./definePlayground";
import { inferKitRootPropBindings } from "./inferKitJsx";

const entries: PlaygroundEntry[] = [
  {
    id: "PrimaryButton",
    meta: { id: "PrimaryButton", title: "PrimaryButton" },
    modulePath: "@dslinter-scan/src/components/PrimaryButton.tsx",
    controls: [],
    renderPreview: () => null,
    Preview: () => null,
  },
];

describe("resolvePlaygroundEntry", () => {
  it("finds by catalog export name id", () => {
    expect(resolvePlaygroundEntry(entries, "PrimaryButton")).toBe(entries[0]);
  });

  it("returns undefined for unknown name", () => {
    expect(resolvePlaygroundEntry(entries, "Missing")).toBeUndefined();
  });
});

describe("playground catalog id alignment", () => {
  it("report playgrounds use export_name as id", () => {
    const report: WorkspaceReport = {
      root: "/repo",
      files: [],
      findings: [],
      scores: {
        design_system_health: 0,
        ux_consistency: 0,
        accessibility: 0,
        maintainability: 0,
      },
      duplicate_components: [],
      usage_by_component: [],
      playgrounds: [
        {
          id: "Card",
          export_name: "Card",
          rel_path: "src/components/nested/DuplicateCardA.tsx",
          declared_props: [],
        },
      ],
    };
    expect(report.playgrounds?.[0]?.id).toBe("Card");
    expect(report.playgrounds?.[0]?.export_name).toBe("Card");
  });
});

describe("playground preview props", () => {
  const report: WorkspaceReport = {
    root: "/repo",
    files: [],
    findings: [],
    scores: {
      design_system_health: 0,
      ux_consistency: 0,
      accessibility: 0,
      maintainability: 0,
    },
    duplicate_components: [],
    usage_by_component: [],
    playgrounds: [
      {
        id: "Demo",
        export_name: "Demo",
        rel_path: "src/components/Demo.tsx",
        declared_props: ["children"],
      },
    ],
  };

  it("maps playground control values even when declared_props omits them", () => {
    const controlOverrides: Record<string, PlaygroundControl[]> = {
      Demo: [
        { key: "children", label: "children", type: "node", default: "" },
        {
          key: "variant",
          label: "variant",
          type: "select",
          default: "primary",
          options: [
            { value: "primary", label: "primary" },
            { value: "muted", label: "muted" },
          ],
        },
      ],
    };
    let lastProps: Record<string, unknown> | null = null;
    const modules = {
      "../components/Demo.tsx": {
        Demo: (props: Record<string, unknown>) => {
          lastProps = props;
          return createElement("span", null, String(props.children ?? ""));
        },
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(report, modules, {
      globKeyFromRelPath: (rel) => `../components/${rel.split("/").pop()}`,
      controlOverrides,
      logJoinSkips: false,
    });
    const entry = entries[0];
    expect(entry).toBeDefined();
    renderToStaticMarkup(
      createElement(entry!.Preview, {
        values: { children: "Hello", variant: "muted" },
      }),
    );
    expect(lastProps).toMatchObject({ children: "Hello", variant: "muted" });
  });

  it("builds select controls from declared_prop_options (CVA)", () => {
    const cvaReport: WorkspaceReport = {
      ...report,
      playgrounds: [
        {
          id: "Button",
          export_name: "Button",
          rel_path: "src/components/ui/button.tsx",
          declared_props: ["variant", "size", "asChild"],
          declared_prop_options: {
            variant: ["default", "destructive", "outline"],
            size: ["default", "sm", "lg"],
          },
          declared_prop_defaults: {
            variant: "default",
            size: "default",
          },
        },
      ],
    };
    let lastProps: Record<string, unknown> | null = null;
    const modules = {
      "../components/ui/button.tsx": {
        Button: (props: Record<string, unknown>) => {
          lastProps = props;
          return createElement("button", props, props.children as ReactNode);
        },
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(cvaReport, modules, {
      globKeyFromRelPath: (rel) => `../components/ui/${rel.split("/").pop()}`,
      logJoinSkips: false,
    });
    const entry = entries[0];
    expect(entry).toBeDefined();
    const variant = entry!.controls.find((c) => c.key === "variant");
    expect(variant?.type).toBe("select");
    if (variant?.type === "select") {
      expect(variant.default).toBe("default");
      expect(variant.options.map((o) => o.value)).toEqual(["default", "destructive", "outline"]);
    }
    const asChild = entry!.controls.find((c) => c.key === "asChild");
    expect(asChild?.type).toBe("boolean");

    const children = entry!.controls.find((c) => c.key === "children");
    expect(children?.type).toBe("node");
    if (children?.type === "node") {
      expect(children.default).toBe("Example");
    }

    renderToStaticMarkup(createElement(entry!.Preview, { values: {} }));
    expect(lastProps).toMatchObject({ children: "Example" });
    const defaultValues = defaultArgsFromControls(entry!.controls);
    expect(entry!.usageSnippet?.(defaultValues)).toBe("<Button>Example</Button>");

    renderToStaticMarkup(createElement(entry!.Preview, { values: { children: "" } }));
    expect(lastProps).toMatchObject({ children: "" });
    expect(entry!.usageSnippet?.({ ...defaultValues, children: "" })).toBe("<Button />");
  });

  it("adds children control from repo usage when declared_props omits it", () => {
    const badgeReport: WorkspaceReport = {
      ...report,
      usage_by_component: [
        {
          component: "Badge",
          reference_count: 3,
          file_count: 2,
          max_props_on_single_use: 2,
          files: [],
          prop_frequencies: { children: 3 },
        },
      ],
      playgrounds: [
        {
          id: "Badge",
          export_name: "Badge",
          rel_path: "src/components/ui/badge.tsx",
          declared_props: ["variant"],
          declared_prop_options: {
            variant: ["default", "secondary"],
          },
          declared_prop_defaults: { variant: "default" },
        },
      ],
    };
    let lastProps: Record<string, unknown> | null = null;
    const modules = {
      "../components/ui/badge.tsx": {
        Badge: (props: Record<string, unknown>) => {
          lastProps = props;
          return createElement("span", props, props.children as ReactNode);
        },
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(badgeReport, modules, {
      globKeyFromRelPath: (rel) => `../components/ui/${rel.split("/").pop()}`,
      logJoinSkips: false,
    });
    const entry = entries[0];
    expect(entry).toBeDefined();
    expect(entry!.controls.some((c) => c.key === "children")).toBe(true);
    renderToStaticMarkup(createElement(entry!.Preview, { values: {} }));
    expect(lastProps).toMatchObject({ children: "Example" });
    const defaultValues = defaultArgsFromControls(entry!.controls);
    expect(entry!.usageSnippet?.(defaultValues)).toBe("<Badge>Example</Badge>");
  });

  it("manual kit playground merges CVA variant select from report", () => {
    function Alert(props: { variant?: string; children?: ReactNode }) {
      return createElement("div", { "data-slot": "alert", "data-variant": props.variant }, props.children);
    }
    function AlertTitle(props: { children?: ReactNode }) {
      return createElement("div", { "data-slot": "alert-title" }, props.children);
    }
    function AlertDescription(props: { children?: ReactNode }) {
      return createElement("div", { "data-slot": "alert-description" }, props.children);
    }

    const kit = ({ title, description, variant }: { title: string; description: string; variant: string }) =>
      createElement(
        Alert,
        { variant },
        createElement(AlertTitle, null, title),
        createElement(AlertDescription, null, description),
      );
    expect(inferKitRootPropBindings(kit)).toEqual([
      { component: "Alert", prop: "variant", param: expect.stringMatching(/^variant\d*$/) },
    ]);
    const defined = definePlayground(kit);

    const alertReport: WorkspaceReport = {
      ...report,
      playgrounds: [
        {
          id: "Alert",
          export_name: "Alert",
          rel_path: "resources/js/components/ui/alert.tsx",
          declared_props: ["variant"],
          declared_prop_options: {
            variant: ["default", "destructive"],
          },
          declared_prop_defaults: {
            variant: "default",
          },
        },
      ],
    };
    const modules = {
      "../components/ui/alert.tsx": {
        Alert: () => createElement("div", null, "auto alert"),
      },
      "../components/ui/alert.playground.tsx": {
        alertPlayground: defined,
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(alertReport, modules, {
      globKeyFromRelPath: (rel) => {
        const name = rel.split("/").pop()!;
        return `../components/ui/${name}`;
      },
      logJoinSkips: false,
    });
    const entry = entries.find((e) => e.id === "Alert");
    expect(entry).toBeDefined();
    const variant = entry!.controls.find((c) => c.key === "variant");
    expect(variant?.type).toBe("select");
    if (variant?.type === "select") {
      expect(variant.options.map((o) => o.value)).toEqual(["default", "destructive"]);
    }
    const title = entry!.controls.find((c) => c.key === "title");
    expect(title?.label).toBe("Title");
  });

  it("definePlayground kit manual entries override auto previews with inferred id", () => {
    const alertReport: WorkspaceReport = {
      ...report,
      playgrounds: [
        {
          id: "Alert",
          export_name: "Alert",
          rel_path: "resources/js/components/ui/alert.tsx",
          declared_props: ["variant"],
        },
      ],
    };
    const defined = definePlayground(({ title = "Heads up" }) =>
      createElement("div", { "data-slot": "alert" }, String(title)),
    );
    const modules = {
      "../components/ui/alert.tsx": {
        Alert: () => createElement("div", null, "auto alert"),
      },
      "../components/ui/alert.playground.tsx": {
        alertPlayground: defined,
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(alertReport, modules, {
      globKeyFromRelPath: (rel) => {
        const name = rel.split("/").pop()!;
        return `../components/ui/${name}`;
      },
      logJoinSkips: false,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("Alert");
    expect(
      renderToStaticMarkup(
        createElement(entries[0]!.Preview, { values: defaultArgsFromControls(entries[0]!.controls) }),
      ),
    ).toBe('<div data-slot="alert">Heads up</div>');
  });

  it("upgrades compound root entry to composed preview with inferred controls", () => {
    const relPath = "resources/js/components/ui/dropdown-menu.tsx";
    const dropdownReport: WorkspaceReport = {
      ...report,
      files: [
        {
          path: `/repo/${relPath}`,
          definitions: [
            { name: "DropdownMenu", kind: "function", line: 1, declared_props: ["open"] },
            {
              name: "DropdownMenuTrigger",
              kind: "function",
              line: 2,
              declared_props: ["children"],
            },
            {
              name: "DropdownMenuContent",
              kind: "function",
              line: 3,
              declared_props: ["align", "sideOffset"],
            },
            {
              name: "DropdownMenuItem",
              kind: "function",
              line: 4,
              declared_props: ["variant"],
            },
          ],
          usages: [],
          parse_errors: [],
        },
      ],
      usage_by_component: [
        {
          component: "DropdownMenuContent",
          reference_count: 10,
          file_count: 5,
          max_props_on_single_use: 2,
          files: [],
          prop_frequencies: { align: 10 },
          prop_value_frequencies: { align: { end: 8, start: 2 } },
        },
      ],
      playgrounds: [
        {
          id: "DropdownMenu",
          export_name: "DropdownMenu",
          rel_path: relPath,
          declared_props: ["open"],
        },
      ],
    };
    const modules = {
      "../components/ui/dropdown-menu.tsx": {
        DropdownMenu: ({ children }: { children?: ReactNode }) =>
          createElement("div", { "data-root": "dropdown-menu" }, children),
        DropdownMenuTrigger: ({ children }: { children?: ReactNode }) =>
          createElement("button", { type: "button" }, children),
        DropdownMenuContent: ({
          children,
          align,
        }: {
          children?: ReactNode;
          align?: string;
        }) => createElement("div", { "data-content": true, "data-align": align }, children),
        DropdownMenuItem: ({ children }: { children?: ReactNode }) =>
          createElement("div", { "data-item": true }, children),
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(dropdownReport, modules, {
      globKeyFromRelPath: (rel) => {
        const name = rel.split("/").pop()!;
        return `../components/ui/${name}`;
      },
      logJoinSkips: false,
    });
    const root = resolvePlaygroundEntry(entries, "DropdownMenu");
    expect(root).toBeDefined();
    expect(root!.id).toBe("DropdownMenu");
    const align = root!.controls.find((c) => c.key === "align");
    expect(align?.type).toBe("select");
    if (align?.type === "select") {
      expect(align.options.map((o) => o.value)).toEqual(["end", "start"]);
    }
    const html = renderToStaticMarkup(createElement(root!.Preview, { values: { align: "end" } }));
    expect(html).toContain('data-root="dropdown-menu"');
    expect(html).toContain("Open menu");
    expect(html).toContain('data-content="true"');
    expect(html).toContain('data-align="end"');
  });

  it("manual definePlayground entries override auto-generated previews", () => {
    const dropdownReport: WorkspaceReport = {
      ...report,
      playgrounds: [
        {
          id: "DropdownMenu",
          export_name: "DropdownMenu",
          rel_path: "resources/js/components/ui/dropdown-menu.tsx",
          declared_props: [],
        },
      ],
    };
    const defined = definePlayground(
      () => createElement("nav", null, "manual menu"),
      { id: "DropdownMenu", group: "ui" },
    );
    const modules = {
      "../components/ui/dropdown-menu.tsx": {
        DropdownMenu: () => createElement("div", null, "auto menu"),
      },
      "../components/ui/dropdown-menu.playground.tsx": {
        dropdownMenuPlayground: defined,
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(dropdownReport, modules, {
      globKeyFromRelPath: (rel) => {
        const name = rel.split("/").pop()!;
        return `../components/ui/${name}`;
      },
      logJoinSkips: false,
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.meta.group).toBe("ui");
    expect(renderToStaticMarkup(createElement(entries[0]!.Preview, { values: {} }))).toBe(
      "<nav>manual menu</nav>",
    );
  });
});
