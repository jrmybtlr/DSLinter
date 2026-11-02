import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { notificationAdapterExample } from "../src/explorer/providerRecovery";
import type { CatalogComponent } from "../src/types/report";
import { mergePreviewSetup } from "./mergePreviewSetup";

const target: CatalogComponent = {
  id: "src/ToastHost.tsx#ToastHost",
  name: "ToastHost",
  framework: "react",
  preview: {
    id: "ToastHost",
    rel_path: "src/ToastHost.tsx",
    export_name: "ToastHost",
    declared_props: [],
    component_imports: {
      Sonner: { specifier: "sonner", export_name: "Toaster", importer: "src/ToastHost.tsx" },
    },
  },
  usages: [],
  dependencies: [],
  bindings: {},
};
const example = notificationAdapterExample(target, "/app", "/app")!;
const jsExample = notificationAdapterExample(target, "/app", "/app", "js")!;
function merge(source: string, path = "dslinter.preview.tsx") {
  return mergePreviewSetup(
    source,
    path.endsWith(".js") ? jsExample : example,
    target.id,
    target.name,
    path,
  );
}

function execute(source: string) {
  const toast = vi.fn();
  const targetComponent = () => null;
  const module = { exports: {} as { default?: any } };
  const require = (specifier: string) => {
    if (specifier === "react")
      return {
        Fragment: "Fragment",
        createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({
          type,
          props,
          children,
        }),
      };
    if (specifier === "sonner") return { toast };
    if (specifier === "dslinter/preview")
      return {
        preview: (component: unknown, decorate?: (props: { node: unknown }) => unknown) => ({
          __dslinterPreview: true,
          component,
          decorate,
        }),
      };
    if (specifier === "./src/ToastHost.tsx") return { ToastHost: targetComponent };
    throw new Error(`Unexpected import ${specifier}`);
  };
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
    },
  });
  new Function(
    "require",
    "module",
    "exports",
    `var React = require("react");\n${compiled.outputText}`,
  )(require, module, module.exports);
  return { adapter: module.exports.default, toast, targetComponent };
}

describe("adding preview entries", () => {
  it("preserves existing settings and comments and generates a working notification trigger", () => {
    const source =
      '// User configuration\nimport { createElement } from "react";\nconst toast = "keep me";\nconst PreviewTarget = "keep this too";\nexport default {\n  styles: ["./custom.css"], // User styles\n  fixtures: { Other: { active: false } },\n  previews: { Other: "existing" },\n};\n';
    const output = merge(source);
    expect(output).toContain('// User configuration\nimport { createElement } from "react";');
    expect(output).toContain('const toast = "keep me";');
    expect(output).toContain('const PreviewTarget = "keep this too";');
    expect(output).toContain('styles: ["./custom.css"], // User styles');
    const { adapter, toast, targetComponent } = execute(output);
    expect(adapter.fixtures.Other.active).toBe(false);
    expect(adapter.previews.Other).toBe("existing");
    const def = adapter.previews.ToastHost;
    expect(def.__dslinterPreview).toBe(true);
    expect(def.component).toBe(targetComponent);
    const node = { type: targetComponent, props: { theme: "dark" }, children: [] };
    const tree = def.decorate({ node });
    expect(tree.children[0]).toEqual(node);
    tree.children[1].props.onClick();
    expect(toast).toHaveBeenCalledWith("Example notification");
  });

  it("adds a previews map to an empty object without breaking the default export", () => {
    expect(execute(merge("export default {};\n")).adapter.previews.ToastHost).toBeDefined();
  });

  it("handles named const configurations and preserves trailing comments without a comma", () => {
    const output = merge(
      'const entries = { Other: "keep" /* entry */ };\nconst config = { previews: entries // keep this comment\n} satisfies Record<string, unknown>;\nexport default config;',
    );
    expect(output).toContain("// keep this comment");
    expect(output).toContain("/* entry */");
    expect(execute(output).adapter.previews.Other).toBe("keep");
  });

  it("supports JavaScript configs without inserting TypeScript syntax", () => {
    const output = merge('export default { styles: ["./app.css"] };', "dslinter.preview.js");
    expect(output).not.toContain("ComponentProps");
    expect(output).not.toContain("satisfies");
    expect(output).toContain("createElement");
    expect(execute(output).adapter.styles).toEqual(["./app.css"]);
  });

  it.each([
    'export default { previews: { "src/ToastHost.tsx#ToastHost": {} } };',
    "export default { previews: { ToastHost: {} } };",
  ])("never replaces a configured preview: %s", (source) => {
    expect(() => merge(source)).toThrow("already configured");
  });

  it.each([
    "export default makeConfig();",
    "export default { ...other };",
    "export default { previews: { ...other } };",
    "export default { previews: { [name]: {} } };",
    "export default { get previews() { return {}; } };",
    "module.exports = {};",
    "export default { previews: {}, previews: {} };",
    "export default { broken: ; };",
  ])("refuses an unsafe merge: %s", (source) => {
    expect(() => merge(source)).toThrow();
  });
});
