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
    preview: {
      id: "Example",
      rel_path: rel,
      export_name: "default",
      declared_props: [],
    },
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
      roles: ["Example item", "Example item 2", "Example item 3"],
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
    expect(component.preview.sample_props.user).toEqual({
      name: "Example name",
    });
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
      JSON.stringify({
        files: [],
        references: [{ path: "./tsconfig.app.json" }],
      }),
    );
    writeFileSync(
      join(root, "tsconfig.app.json"),
      JSON.stringify({
        compilerOptions: { jsx: "react-jsx" },
        include: ["src"],
      }),
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
  expect(component.preview.sample_props.items).toEqual([
    { title: "Example title", href: "#" },
    { title: "Example title 2", href: "#" },
    { title: "Example title 3", href: "#" },
  ]);
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

it("resolves Nuxt aliases through referenced tsconfigs and builds realistic list rows", () => {
  const { root, report, component } = project(
    `<script setup lang="ts">
    import type { HourlySnapshot } from '~/types/weather'
    defineProps<{ hours: HourlySnapshot[]; previewHour?: number | null }>()
    </script><template><ol><li v-for="hour in hours" :key="hour.time">{{ hour.temperature }}</li></ol></template>`,
    "vue",
  );
  mkdirSync(join(root, "src/types"));
  mkdirSync(join(root, ".nuxt"));
  writeFileSync(
    join(root, "src/types/weather.ts"),
    "export interface HourlySnapshot { time: string; temperature: number; precipChance: number | null; isDay?: boolean; observed?: Date }",
  );
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      files: [],
      references: [{ path: "./.nuxt/tsconfig.app.json" }],
    }),
  );
  writeFileSync(
    join(root, ".nuxt/tsconfig.app.json"),
    JSON.stringify({
      compilerOptions: { strict: true, paths: { "~/*": ["../src/*"] } },
      include: ["../src/**/*"],
    }),
  );
  enrichCatalog(report, root);
  expect(component.metadata_error).toBeUndefined();
  const hours = component.preview.sample_props.hours;
  expect(hours).toHaveLength(3);
  expect(hours[0]).toEqual({
    time: "2025-06-02T09:00:00",
    temperature: 18,
    precipChance: 30,
    isDay: true,
  });
  expect(new Set(hours.map((hour) => hour.time)).size).toBe(3);
  expect(component.preview.sample_props.previewHour).toBeUndefined();
});

it("samples optional collections but leaves optional flags and error state alone", () => {
  const { root, report, component } = project(
    `<script setup lang="ts">
    defineProps<{ items?: { label: string }[]; tags?: string[]; errors?: string[]; compact?: boolean; note?: string }>()
    </script><template><ul><li v-for="item in items">{{ item.label }}</li></ul></template>`,
    "vue",
  );
  enrichCatalog(report, root);
  expect(component.preview.sample_props).toEqual({
    items: [{ label: "Example label" }, { label: "Example label 2" }, { label: "Example label 3" }],
    tags: ["Example item", "Example item 2", "Example item 3"],
  });
});

it("reads runtime defineProps declarations, including PropType casts", () => {
  const { root, report, component } = project(
    `<script setup lang="ts">
    import type { PropType } from 'vue'
    defineProps({
      rows: { type: Array as PropType<{ name: string; createdAt: string }[]>, required: true },
      heading: { type: String, required: true },
      size: { type: String as PropType<'sm' | 'lg'>, default: 'sm' },
      count: Number,
    })
    </script><template><h2>{{ heading }}</h2></template>`,
    "vue",
  );
  enrichCatalog(report, root);
  expect(component.metadata_error).toBeUndefined();
  expect(component.preview.declared_props).toEqual(["rows", "heading", "size", "count"]);
  expect(component.preview.declared_prop_kinds).toMatchObject({
    rows: "object",
    heading: "string",
    size: "string",
    count: "number",
  });
  expect(component.preview.declared_prop_options.size).toEqual(
    expect.arrayContaining(["sm", "lg"]),
  );
  expect(component.preview.declared_prop_defaults.size).toBe("sm");
  expect(component.preview.sample_props.heading).toBe("Example heading");
  expect(component.preview.sample_props.rows[1]).toEqual({
    name: "Example name 2",
    createdAt: "2025-06-02T10:00:00",
  });
  expect(component.preview.sample_props.count).toBeUndefined();
});

it("treats template guards on data props as reveal candidates, but not loading or error", () => {
  const { root, report, component } = project(
    `<script setup lang="ts">
    defineProps<{ count?: number; summary?: string; loading?: boolean; error?: string }>()
    </script><template>
      <p v-if="loading">Loading</p>
      <p v-else-if="error">{{ error }}</p>
      <section v-else-if="count && summary">{{ summary }}</section>
    </template>`,
    "vue",
  );
  enrichCatalog(report, root);
  expect(component.preview.visibility_props).toEqual(["count", "summary"]);
  expect(component.preview.visibility_values).toEqual({
    count: 1,
    summary: "Example summary",
  });
});
