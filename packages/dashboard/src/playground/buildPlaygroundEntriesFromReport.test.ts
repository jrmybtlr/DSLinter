import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlaygroundControl, PlaygroundEntry } from "../types/playground";
import type { WorkspaceReport } from "../types/report";
import { defaultArgsFromControls } from "../types/controls";
import {
  buildPlaygroundEntriesFromReportWithSkips,
  resolvePlaygroundEntry,
} from "./buildPlaygroundEntriesFromReport";
import { definePlayground } from "./definePlayground";

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
        system_health: 0,
        token_adoption: 0,
        component_adoption: 0,
        ux_consistency: 0,
      },
      ownership: [],
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
      system_health: 0,
      token_adoption: 0,
      component_adoption: 0,
      ux_consistency: 0,
    },
    ownership: [],
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
        { key: "children", label: "children", type: "string", default: "" },
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
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(
      report,
      modules,
      {
        globKeyFromRelPath: (rel) => `../components/${rel.split("/").pop()}`,
        controlOverrides,
        logJoinSkips: false,
      },
    );
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
          return createElement("button", props, props.children);
        },
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(
      cvaReport,
      modules,
      {
        globKeyFromRelPath: (rel) => `../components/ui/${rel.split("/").pop()}`,
        logJoinSkips: false,
      },
    );
    const entry = entries[0];
    expect(entry).toBeDefined();
    const variant = entry!.controls.find((c) => c.key === "variant");
    expect(variant?.type).toBe("select");
    if (variant?.type === "select") {
      expect(variant.default).toBe("default");
      expect(variant.options.map((o) => o.value)).toEqual([
        "default",
        "destructive",
        "outline",
      ]);
    }
    const asChild = entry!.controls.find((c) => c.key === "asChild");
    expect(asChild?.type).toBe("boolean");

    const children = entry!.controls.find((c) => c.key === "children");
    expect(children?.type).toBe("string");
    if (children?.type === "string") {
      expect(children.default).toBe("Example");
    }

    renderToStaticMarkup(createElement(entry!.Preview, { values: {} }));
    expect(lastProps).toMatchObject({ children: "Example" });
    const defaultValues = defaultArgsFromControls(entry!.controls);
    expect(entry!.usageSnippet?.(defaultValues)).toBe("<Button>Example</Button>");
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
          return createElement("span", props, props.children);
        },
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(
      badgeReport,
      modules,
      {
        globKeyFromRelPath: (rel) => `../components/ui/${rel.split("/").pop()}`,
        logJoinSkips: false,
      },
    );
    const entry = entries[0];
    expect(entry).toBeDefined();
    expect(entry!.controls.some((c) => c.key === "children")).toBe(true);
    renderToStaticMarkup(createElement(entry!.Preview, { values: {} }));
    expect(lastProps).toMatchObject({ children: "Example" });
    const defaultValues = defaultArgsFromControls(entry!.controls);
    expect(entry!.usageSnippet?.(defaultValues)).toBe("<Badge>Example</Badge>");
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
    const defined = definePlayground({
      id: "DropdownMenu",
      group: "ui",
      render: () => createElement("nav", null, "manual menu"),
    });
    const modules = {
      "../components/ui/dropdown-menu.tsx": {
        DropdownMenu: () => createElement("div", null, "auto menu"),
      },
      "../components/ui/dropdown-menu.playground.tsx": {
        dropdownMenuPlayground: defined,
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(
      dropdownReport,
      modules,
      {
        globKeyFromRelPath: (rel) => {
          const name = rel.split("/").pop()!;
          return `../components/ui/${name}`;
        },
        logJoinSkips: false,
      },
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.meta.group).toBe("ui");
    expect(renderToStaticMarkup(createElement(entries[0]!.Preview, { values: {} }))).toBe(
      "<nav>manual menu</nav>",
    );
  });
});
