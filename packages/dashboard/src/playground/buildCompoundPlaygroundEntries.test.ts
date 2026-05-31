import { createElement, forwardRef, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WorkspaceReport } from "../types/report";
import {
  buildCompoundPlaygroundEntries,
  detectCompoundFamily,
  findCompoundFamilies,
} from "./buildCompoundPlaygroundEntries";
import { buildPlaygroundEntriesFromReportWithSkips } from "./buildPlaygroundEntriesFromReport";
import { resolvePlaygroundEntry } from "./buildPlaygroundEntriesFromReport";

function dropdownModule() {
  return {
    Dropdown: ({ children }: { children?: ReactNode }) =>
      createElement("div", { "data-root": "dropdown" }, children),
    DropdownTrigger: ({ children }: { children?: ReactNode }) =>
      createElement("button", { type: "button" }, children),
    DropdownMenu: forwardRef(
      (
        {
          children,
          align,
        }: {
          children?: ReactNode;
          align?: string;
        },
        _ref,
      ) => createElement("div", { "data-menu": true, "data-align": align }, children),
    ),
    DropdownItem: forwardRef(({ children }: { children?: ReactNode }, _ref) =>
      createElement("div", { "data-item": true }, children),
    ),
    DropdownSeparator: () => createElement("hr"),
  };
}

describe("detectCompoundFamily", () => {
  it("detects Dropdown compound family", () => {
    const exports = new Map([
      [
        "Dropdown",
        {
          name: "Dropdown",
          kind: "function" as const,
          line: 1,
          declared_props: ["open"],
        },
      ],
      [
        "DropdownTrigger",
        {
          name: "DropdownTrigger",
          kind: "function" as const,
          line: 2,
          declared_props: ["children"],
        },
      ],
      [
        "DropdownMenu",
        {
          name: "DropdownMenu",
          kind: "wrapped_component" as const,
          line: 3,
        },
      ],
      [
        "DropdownItem",
        {
          name: "DropdownItem",
          kind: "wrapped_component" as const,
          line: 4,
        },
      ],
    ]);

    const family = detectCompoundFamily("resources/js/Components/Dropdown.jsx", exports);
    expect(family).toMatchObject({
      root: "Dropdown",
      trigger: "DropdownTrigger",
      content: "DropdownMenu",
    });
  });

  it("detects shadcn-style kebab filenames with PascalCase root exports", () => {
    const exports = new Map([
      [
        "DropdownMenu",
        {
          name: "DropdownMenu",
          kind: "function" as const,
          line: 1,
        },
      ],
      [
        "DropdownMenuTrigger",
        {
          name: "DropdownMenuTrigger",
          kind: "function" as const,
          line: 2,
        },
      ],
      [
        "DropdownMenuContent",
        {
          name: "DropdownMenuContent",
          kind: "function" as const,
          line: 3,
        },
      ],
      [
        "DropdownMenuItem",
        {
          name: "DropdownMenuItem",
          kind: "function" as const,
          line: 4,
        },
      ],
    ]);

    const family = detectCompoundFamily(
      "resources/js/components/ui/dropdown-menu.tsx",
      exports,
      "ui",
    );
    expect(family).toMatchObject({
      root: "DropdownMenu",
      trigger: "DropdownMenuTrigger",
      content: "DropdownMenuContent",
      group: "ui",
    });
  });

  it("returns null for single-export file", () => {
    const exports = new Map([
      [
        "Button",
        {
          name: "Button",
          kind: "function" as const,
          line: 1,
        },
      ],
    ]);
    expect(detectCompoundFamily("src/components/Button.tsx", exports)).toBeNull();
  });
});

describe("buildCompoundPlaygroundEntries", () => {
  const report: WorkspaceReport = {
    root: "/repo",
    files: [
      {
        path: "/repo/resources/js/Components/Dropdown.jsx",
        definitions: [
          {
            name: "Dropdown",
            kind: "function",
            line: 1,
            declared_props: ["open"],
          },
          {
            name: "DropdownTrigger",
            kind: "function",
            line: 2,
            declared_props: ["children"],
          },
          {
            name: "DropdownMenu",
            kind: "wrapped_component",
            line: 3,
          },
          {
            name: "DropdownItem",
            kind: "wrapped_component",
            line: 4,
          },
          {
            name: "DropdownSeparator",
            kind: "wrapped_component",
            line: 5,
          },
        ],
        usages: [],
        parse_errors: [],
      },
    ],
    findings: [],
    scores: {
      design_system_health: 0,
      ux_consistency: 0,
      accessibility: 0,
      maintainability: 0,
    },
    ownership: [],
    duplicate_components: [],
    usage_by_component: [
      {
        component: "DropdownMenu",
        reference_count: 10,
        file_count: 5,
        max_props_on_single_use: 2,
        files: [],
        prop_frequencies: { align: 10, children: 10 },
        prop_value_frequencies: { align: { end: 8, start: 2 } },
      },
    ],
    playgrounds: [
      {
        id: "Dropdown",
        export_name: "Dropdown",
        rel_path: "resources/js/Components/Dropdown.jsx",
        declared_props: ["open"],
      },
    ],
  };

  const modules = {
    "@dslinter-scan/resources/js/Components/Dropdown.jsx": dropdownModule(),
  };

  it("finds compound families from report", () => {
    const families = findCompoundFamilies(report);
    expect(families).toHaveLength(1);
    expect(families[0]?.root).toBe("Dropdown");
  });

  it("builds DropdownMenu compound entry with align select control", () => {
    const entries = buildCompoundPlaygroundEntries(report, modules, {
      globKeyFromRelPath: (rel) => `@dslinter-scan/${rel}`,
      existingIds: new Set(["Dropdown"]),
    });
    const menu = entries.find((e) => e.id === "DropdownMenu");
    expect(menu).toBeDefined();
    const align = menu!.controls.find((c) => c.key === "align");
    expect(align?.type).toBe("select");
    if (align?.type === "select") {
      expect(align.options.map((o) => o.value)).toEqual(["end", "start"]);
    }
  });

  it("renders compound tree for DropdownMenu", () => {
    const entries = buildCompoundPlaygroundEntries(report, modules, {
      globKeyFromRelPath: (rel) => `@dslinter-scan/${rel}`,
      existingIds: new Set(["Dropdown"]),
    });
    const menu = entries.find((e) => e.id === "DropdownMenu")!;
    const html = renderToStaticMarkup(createElement(menu.Preview, { values: { align: "end" } }));
    expect(html).toContain('data-root="dropdown"');
    expect(html).toContain("Open menu");
    expect(html).toContain('data-menu="true"');
    expect(html).toContain('data-align="end"');
  });

  it("merges compound entries in buildPlaygroundEntriesFromReportWithSkips", () => {
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(report, modules, {
      logJoinSkips: false,
    });
    expect(resolvePlaygroundEntry(entries, "Dropdown")).toBeDefined();
    expect(resolvePlaygroundEntry(entries, "DropdownMenu")).toBeDefined();
    expect(resolvePlaygroundEntry(entries, "DropdownItem")).toBeDefined();
  });

  it("upgrades shadcn DropdownMenu root to composed content preview", () => {
    const relPath = "resources/js/components/ui/dropdown-menu.tsx";
    const shadcnReport: WorkspaceReport = {
      root: "/repo",
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
              declared_props: ["align"],
            },
            { name: "DropdownMenuItem", kind: "function", line: 4, declared_props: [] },
          ],
          usages: [],
          parse_errors: [],
        },
      ],
      findings: [],
      scores: {
        design_system_health: 0,
        ux_consistency: 0,
        accessibility: 0,
        maintainability: 0,
      },
      ownership: [],
      duplicate_components: [],
      usage_by_component: [
        {
          component: "DropdownMenuContent",
          reference_count: 5,
          file_count: 2,
          max_props_on_single_use: 1,
          files: [],
          prop_frequencies: { align: 5 },
          prop_value_frequencies: { align: { end: 4, start: 1 } },
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
    const shadcnModules = {
      "@dslinter-scan/resources/js/components/ui/dropdown-menu.tsx": {
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
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(shadcnReport, shadcnModules, {
      globKeyFromRelPath: (rel) => `@dslinter-scan/${rel}`,
      logJoinSkips: false,
    });
    const root = resolvePlaygroundEntry(entries, "DropdownMenu");
    expect(root?.id).toBe("DropdownMenu");
    const align = root!.controls.find((c) => c.key === "align");
    expect(align?.type).toBe("select");
    const html = renderToStaticMarkup(createElement(root!.Preview, { values: { align: "end" } }));
    expect(html).toContain('data-root="dropdown-menu"');
    expect(html).toContain('data-content="true"');
    expect(html).toContain('data-align="end"');
  });
});
