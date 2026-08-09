import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ExampleNode, WorkspaceReport } from "../types/report";
import { buildPlaygroundEntriesFromReportWithSkips } from "./buildPlaygroundEntriesFromReport";
import { shouldUseExampleTreePreview } from "./shouldUseExampleTreePreview";

const REL_PATH = "resources/js/components/ui/breadcrumb.tsx";

function breadcrumbModule() {
  return {
    Breadcrumb: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("nav", { "aria-label": "breadcrumb", ...props }, children),
    BreadcrumbList: ({ children }: { children?: ReactNode }) => createElement("ol", null, children),
    BreadcrumbItem: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("li", props, children),
    BreadcrumbLink: ({ asChild, children }: { asChild?: boolean; children?: ReactNode }) =>
      asChild ? children : createElement("a", { href: "#" }, children),
    BreadcrumbPage: ({ children }: { children?: ReactNode }) =>
      createElement("span", { "aria-current": "page" }, children),
    BreadcrumbSeparator: () => createElement("li", { role: "presentation" }, "/"),
  };
}

/** Mirrors what the Rust scanner captures from the demo `breadcrumbs.tsx`. */
const exampleTree: ExampleNode = {
  type: "element",
  name: "Breadcrumb",
  children: [
    {
      type: "element",
      name: "BreadcrumbList",
      children: [
        {
          type: "element",
          name: "BreadcrumbItem",
          children: [
            {
              type: "element",
              name: "BreadcrumbLink",
              props: { asChild: { kind: "bool", value: true } },
              children: [
                {
                  type: "element",
                  name: "Link",
                  children: [{ type: "placeholder", hint: "Title" }],
                },
              ],
            },
          ],
        },
        { type: "element", name: "BreadcrumbSeparator" },
        {
          type: "element",
          name: "BreadcrumbItem",
          children: [
            {
              type: "element",
              name: "BreadcrumbPage",
              children: [{ type: "placeholder", hint: "Title" }],
            },
          ],
        },
      ],
    },
  ],
};

const report: WorkspaceReport = {
  root: "/repo",
  files: [
    {
      path: `/repo/${REL_PATH}`,
      definitions: [
        { name: "Breadcrumb", kind: "function", line: 1 },
        { name: "BreadcrumbList", kind: "function", line: 2 },
        { name: "BreadcrumbItem", kind: "function", line: 3, declared_props: ["className"] },
        { name: "BreadcrumbLink", kind: "function", line: 4 },
        { name: "BreadcrumbPage", kind: "function", line: 5 },
        { name: "BreadcrumbSeparator", kind: "function", line: 6 },
      ],
      parse_errors: [],
    },
  ],
  findings: [],
  duplicate_components: [],
  usage_by_component: [],
  scores: {
    design_system_health: 0,
    ux_consistency: 0,
    accessibility: 0,
    maintainability: 0,
  },
  playgrounds: [
    {
      id: "Breadcrumb",
      export_name: "Breadcrumb",
      rel_path: REL_PATH,
      declared_props: [],
      example_tree: exampleTree,
    },
  ],
};

const modules = { [`@dslinter-scan/${REL_PATH}`]: breadcrumbModule() };
const options = { globKeyFromRelPath: (rel: string) => `@dslinter-scan/${rel}` };

describe("usage-derived example tree previews", () => {
  it("renders the full composition for the root instead of an empty shell", () => {
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(report, modules, options);
    const root = entries.find((e) => e.id === "Breadcrumb");
    expect(root).toBeDefined();

    const html = renderToStaticMarkup(root!.renderPreview({}) as never);
    expect(html).toContain('aria-label="breadcrumb"');
    expect(html).toContain("<ol>");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Title");
    // `!isLast && <Separator/>` idiom survives capture.
    expect(html).toContain('role="presentation"');
  });

  it("omits the children control when an example tree drives the preview", () => {
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(report, modules, options);
    const root = entries.find((e) => e.id === "Breadcrumb")!;
    expect(root.controls.some((c) => c.key === "children")).toBe(false);
  });

  it("derives the usage snippet from the tree", () => {
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(report, modules, options);
    const root = entries.find((e) => e.id === "Breadcrumb")!;
    const snippet = root.usageSnippet!({});
    expect(snippet).toContain("<Breadcrumb>");
    expect(snippet).toContain("  <BreadcrumbList>");
    expect(snippet).toContain("<BreadcrumbSeparator />");
    expect(snippet).toContain("</Breadcrumb>");
  });

  it("renders sub-exports inside the captured family context", () => {
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(report, modules, options);
    const item = entries.find((e) => e.id === "BreadcrumbItem");
    expect(item).toBeDefined();

    const html = renderToStaticMarkup(item!.renderPreview({ className: "highlight" }) as never);
    // Full family context, not a bare <li> mounted under the root.
    expect(html).toContain('aria-label="breadcrumb"');
    expect(html).toContain("<ol>");
    // Control values merge into the first matching target element.
    expect(html).toContain('class="highlight"');
  });

  it("falls back to compound heuristics for sub-exports missing from the tree", () => {
    const reportWithEllipsis: WorkspaceReport = {
      ...report,
      files: [
        {
          ...report.files[0]!,
          definitions: [
            ...report.files[0]!.definitions,
            { name: "BreadcrumbEllipsis", kind: "function", line: 7 },
          ],
        },
      ],
    };
    const mod = {
      ...breadcrumbModule(),
      BreadcrumbEllipsis: () => createElement("span", { "data-ellipsis": true }, "…"),
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(
      reportWithEllipsis,
      { [`@dslinter-scan/${REL_PATH}`]: mod },
      options,
    );
    const ellipsis = entries.find((e) => e.id === "BreadcrumbEllipsis");
    expect(ellipsis).toBeDefined();
    const html = renderToStaticMarkup(ellipsis!.renderPreview({}) as never);
    expect(html).toContain("data-ellipsis");
  });

  it("prefers live render for CVA Button with external Avatar usage tree", () => {
    const buttonTree: ExampleNode = {
      type: "element",
      name: "Button",
      props: { variant: { kind: "string", value: "ghost" } },
      children: [el("Avatar")],
    };
    const buttonReport: WorkspaceReport = {
      ...report,
      playgrounds: [
        {
          id: "Button",
          export_name: "Button",
          rel_path: "resources/js/components/ui/button.tsx",
          declared_props: ["variant", "size"],
          declared_prop_options: {
            variant: ["default", "ghost"],
            size: ["default", "sm"],
          },
          example_tree: buttonTree,
        },
      ],
      files: [
        ...report.files,
        {
          path: "/repo/resources/js/components/ui/button.tsx",
          definitions: [{ name: "Button", kind: "function", line: 1 }],
          parse_errors: [],
        },
      ],
    };
    expect(
      shouldUseExampleTreePreview(buttonReport.playgrounds![0]!, buttonTree, buttonReport),
    ).toBe(false);

    const modules = {
      [`@dslinter-scan/resources/js/components/ui/button.tsx`]: {
        Button: ({ children, ...props }: { children?: ReactNode }) =>
          createElement("button", props, children),
      },
    };
    const { entries } = buildPlaygroundEntriesFromReportWithSkips(buttonReport, modules, {
      globKeyFromRelPath: (rel) => `@dslinter-scan/${rel}`,
    });
    const button = entries.find((e) => e.id === "Button")!;
    const html = renderToStaticMarkup(button.renderPreview({ variant: "default" }) as never);
    expect(html).toContain("<button");
    expect(html).not.toContain("Avatar");
  });
});

function el(name: string, children: ExampleNode[] = []): ExampleNode {
  return { type: "element", name, children };
}
