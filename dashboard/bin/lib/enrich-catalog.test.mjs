import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { enrichCatalog } from "./enrich-catalog.mjs";

function project(source, framework = "react") {
  const root = mkdtempSync(join(tmpdir(), "dslinter-metadata-"));
  mkdirSync(join(root, "src"));
  symlinkSync(resolve("node_modules"), join(root, "node_modules"));
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        strict: true,
        module: "ESNext",
        moduleResolution: "bundler",
        skipLibCheck: true,
      },
      include: ["src"],
    }),
  );
  const rel = framework === "vue" ? "src/Example.vue" : "src/Example.tsx";
  writeFileSync(join(root, rel), source);
  const component = {
    id: `${rel}#default`,
    name: "Example",
    framework,
    preview: { id: "Example", rel_path: rel, export_name: "default", declared_props: [] },
    usages: [],
    bindings: {},
    dependencies: [],
  };
  return { root, report: { components: [component] }, component };
}

describe("catalog metadata", () => {
  it("generates bounded object and array fixtures for default React exports", () => {
    const { root, report, component } = project(
      "export default function Example({ user }: { user: { name: string; email: string; roles: string[]; age: number } }) { return <div>{user.name}</div> }",
    );
    expect(enrichCatalog(report, root)).toBe(true);
    expect(component.preview.declared_prop_kinds.user).toBe("object");
    expect(component.preview.sample_props.user).toEqual({
      name: "Example name",
      email: "example@example.test",
      roles: ["Example item"],
      age: 1,
    });
  });

  it("uses Vue compiler metadata for slots, models, emits and required data", () => {
    const { root, report, component } = project(
      `<script setup lang="ts">
      defineProps<{ user: { name: string } }>();
      defineModel<string>();
      defineEmits<{ change: [value: string] }>();
      defineSlots<{ default(): unknown; footer(): unknown }>();
      </script><template><slot/><slot name="footer"/></template>`,
      "vue",
    );
    enrichCatalog(report, root);
    expect(component.metadata_error).toBeUndefined();
    expect(component.preview.slots).toEqual(["default", "footer"]);
    expect(component.preview.models).toEqual(["modelValue"]);
    expect(component.preview.emits).toContain("change");
    expect(component.preview.sample_props.user).toEqual({ name: "Example name" });
    writeFileSync(
      join(root, "src/Page.vue"),
      '<script setup>import Example from "./Example.vue";</script>\n<template><Example><template #footer>Saved footer</template></Example></template>',
    );
    component.example_source = { path: "src/Page.vue", line: 2 };
    component.bindings = { Example: component.id };
    enrichCatalog(report, root);
    expect(component.preview.example_tree.children[0]).toMatchObject({
      name: "template",
      slot: "footer",
      children: [{ type: "text", value: "Saved footer" }],
    });
  });
  it("infers props when the root tsconfig only references app projects", () => {
    const { root, report, component } = project(
      "export default function Example({label}: {label: string}) { return <button>{label}</button> }",
    );
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({ files: [], references: [{ path: "./tsconfig.app.json" }] }),
    );
    writeFileSync(
      join(root, "tsconfig.app.json"),
      JSON.stringify({ compilerOptions: { jsx: "react-jsx" }, include: ["src"] }),
    );
    enrichCatalog(report, root);
    expect(component.preview.sample_props.label).toBe("Example label");
    expect(component.preview.native_element).toBe("button");
  });

  it("reads model controls from a Vue component exported through a plain module", () => {
    const { root, report, component } = project(
      "declare const Primitive: new <T>() => { $props: { modelValue?: T | T[]; disabled?: boolean } }; export default Primitive;",
    );
    component.framework = "vue";
    enrichCatalog(report, root);
    expect(component.metadata_error).toBeUndefined();
    expect(component.preview.models).toEqual(["modelValue"]);
    expect(component.preview.declared_prop_kinds.modelValue).toBe("string");
    expect(component.preview.declared_prop_kinds.disabled).toBe("boolean");
  });
});

it("preserves structured arrays and source-backed visibility/import metadata", () => {
  const { root, report, component } = project(`import { Circle as Glyph } from 'lucide-react';
    export default function Example({items, canShow = false, open = false}: {items: {title:string; href:string}[]; canShow?:boolean; open?:boolean}) {
      if (!canShow) return null;
      return <div><Glyph />{items.map(item=><span>{item.title}</span>)}</div>
    }`);
  component.example_source = { path: "src/Example.tsx", line: 2 };
  enrichCatalog(report, root);
  expect(component.preview.declared_prop_kinds.items).toBe("object");
  expect(component.preview.sample_props.items).toEqual([{ title: "Example title", href: "#" }]);
  expect(component.preview.visibility_props).toEqual(["canShow"]);
  expect(component.preview.source_imports.Glyph).toEqual({
    specifier: "lucide-react",
    importer: "src/Example.tsx",
    export_name: "Circle",
  });
});

it("infers Vue template visibility guards without enabling unrelated flags", () => {
  const { root, report, component } = project(
    '<script setup lang="ts">defineProps<{ visible?: boolean; disabled?: boolean }>();</script><template><span v-if="visible">Content</span></template>',
    "vue",
  );
  enrichCatalog(report, root);
  expect(component.preview.visibility_props).toEqual(["visible"]);
  expect(component.preview.visibility_values).toEqual({ visible: true });
});
