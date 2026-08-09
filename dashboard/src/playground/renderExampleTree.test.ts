import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ExampleNode } from "../types/report";
import {
  createExampleComponentResolver,
  exampleTreeContainsElement,
  exampleTreeSnippet,
  renderExampleTree,
} from "./renderExampleTree";

function el(
  name: string,
  props: Record<string, string | number | boolean> = {},
  children: ExampleNode[] = [],
): ExampleNode {
  const exampleProps: NonNullable<Extract<ExampleNode, { type: "element" }>["props"]> = {};
  for (const [key, value] of Object.entries(props)) {
    exampleProps[key] =
      typeof value === "string"
        ? { kind: "string", value }
        : typeof value === "number"
          ? { kind: "number", value }
          : { kind: "bool", value };
  }
  return { type: "element", name, props: exampleProps, children };
}

const text = (value: string): ExampleNode => ({ type: "text", value });
const placeholder = (hint: string): ExampleNode => ({ type: "placeholder", hint });

const cardModule = {
  Card: ({ children, ...props }: { children?: ReactNode }) =>
    createElement("div", { "data-card": true, ...props }, children),
  CardTitle: ({ children }: { children?: ReactNode }) => createElement("h3", null, children),
};

const otherModule = {
  Badge: ({ children }: { children?: ReactNode }) =>
    createElement("span", { "data-badge": true }, children),
};

const modules = { "@scan/card.tsx": cardModule, "@scan/badge.tsx": otherModule };

describe("renderExampleTree", () => {
  it("renders elements resolved from the primary module and intrinsics", () => {
    const resolve = createExampleComponentResolver(cardModule, modules);
    const tree = el("Card", { "data-size": "lg" }, [
      el("CardTitle", {}, [text("Hello")]),
      el("p", {}, [text("Body")]),
    ]);
    const html = renderToStaticMarkup(renderExampleTree(tree, resolve) as never);
    expect(html).toContain("data-card");
    expect(html).toContain('data-size="lg"');
    expect(html).toContain("<h3>Hello</h3>");
    expect(html).toContain("<p>Body</p>");
  });

  it("resolves components from other scanned modules", () => {
    const resolve = createExampleComponentResolver(cardModule, modules);
    const tree = el("Card", {}, [el("Badge", {}, [text("New")])]);
    const html = renderToStaticMarkup(renderExampleTree(tree, resolve) as never);
    expect(html).toContain("data-badge");
    expect(html).toContain("New");
  });

  it("degrades unresolvable components: href to anchor, children to span, else nothing", () => {
    const resolve = createExampleComponentResolver(cardModule, modules);
    const tree = el("Card", {}, [
      el("Link", { href: "/about", onWeird: true }, [text("About")]),
      el("RouterThing", {}, [text("Wrapped")]),
      el("CheckIcon"),
    ]);
    const html = renderToStaticMarkup(renderExampleTree(tree, resolve) as never);
    expect(html).toContain('<a href="/about">About</a>');
    expect(html).not.toContain("onWeird");
    expect(html).toContain("<span>Wrapped</span>");
    expect(html).not.toContain("CheckIcon");
  });

  it("renders placeholders as their hint text", () => {
    const resolve = createExampleComponentResolver(cardModule, modules);
    const tree = el("CardTitle", {}, [placeholder("Title")]);
    const html = renderToStaticMarkup(renderExampleTree(tree, resolve) as never);
    expect(html).toBe("<h3>Title</h3>");
  });

  it("merges rootProps over captured root props", () => {
    const resolve = createExampleComponentResolver(cardModule, modules);
    const tree = el("Card", { "data-size": "lg" }, [text("x")]);
    const html = renderToStaticMarkup(
      renderExampleTree(tree, resolve, { rootProps: { "data-size": "sm" } }) as never,
    );
    expect(html).toContain('data-size="sm"');
    expect(html).not.toContain('data-size="lg"');
  });

  it("merges target props into the first matching element only", () => {
    const resolve = createExampleComponentResolver(cardModule, modules);
    const tree = el("Card", {}, [el("em", {}, [text("A")]), el("em", {}, [text("B")])]);
    const html = renderToStaticMarkup(
      renderExampleTree(tree, resolve, {
        target: { name: "em", props: { className: "hit" } },
      }) as never,
    );
    expect(html).toContain('<em class="hit">A</em>');
    expect(html).toContain("<em>B</em>");
  });
});

describe("exampleTreeContainsElement", () => {
  const tree = el("Card", {}, [el("CardTitle", {}, [text("x")])]);

  it("finds root and nested names", () => {
    expect(exampleTreeContainsElement(tree, "Card")).toBe(true);
    expect(exampleTreeContainsElement(tree, "CardTitle")).toBe(true);
    expect(exampleTreeContainsElement(tree, "CardFooter")).toBe(false);
  });
});

describe("exampleTreeSnippet", () => {
  it("formats nested trees with indentation and boolean shorthand", () => {
    const tree = el("Breadcrumb", {}, [
      el("BreadcrumbList", {}, [
        el("BreadcrumbItem", {}, [
          el("BreadcrumbLink", { asChild: true }, [el("Link", {}, [placeholder("Title")])]),
        ]),
        el("BreadcrumbSeparator"),
      ]),
    ]);
    expect(exampleTreeSnippet(tree)).toBe(
      [
        "<Breadcrumb>",
        "  <BreadcrumbList>",
        "    <BreadcrumbItem>",
        "      <BreadcrumbLink asChild>",
        "        <Link>Title</Link>",
        "      </BreadcrumbLink>",
        "    </BreadcrumbItem>",
        "    <BreadcrumbSeparator />",
        "  </BreadcrumbList>",
        "</Breadcrumb>",
      ].join("\n"),
    );
  });

  it("merges root overrides and drops empty/false values", () => {
    const tree = el("Card", { size: "lg" }, [text("x")]);
    expect(
      exampleTreeSnippet(tree, { rootProps: { size: "sm", className: "", disabled: false } }),
    ).toBe('<Card size="sm">x</Card>');
  });
});
