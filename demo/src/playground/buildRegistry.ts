import { createElement, type ComponentType } from "react";
import type {
  PlaygroundArgs,
  PlaygroundControl,
  PlaygroundEntry,
  PlaygroundMeta,
  PlaygroundPreviewComponent,
  WorkspaceReport,
} from "@dslint/workbench";

import { playgroundStaticDefaults } from "./playgroundDefaults";

const modules = import.meta.glob("../components/**/*.tsx", {
  eager: true,
}) as Record<string, Record<string, unknown>>;

function relPathToGlobKey(relPath: string): string {
  const trimmed = relPath.replace(/^\/+/, "").replace(/^src\//, "");
  return `../${trimmed}`;
}

function isLikelyBooleanProp(name: string): boolean {
  const n = name.toLowerCase();
  if (n === "disabled") return true;
  if (n.startsWith("is") || n.startsWith("has")) return true;
  if (n.startsWith("show") || n.startsWith("hide")) return true;
  return false;
}

function defaultStringForProp(key: string): string {
  if (key === "href") return "#!/governance";
  const k = key.toLowerCase();
  if (k === "title" || k === "label" || k === "text" || k === "name" || k === "heading") {
    return "Label";
  }
  return key;
}

function controlsFromDeclaredProps(declaredProps: string[]): PlaygroundControl[] {
  const skip = new Set(["key", "ref"]);
  const out: PlaygroundControl[] = [];
  for (const key of declaredProps) {
    if (skip.has(key)) continue;
    if (key === "children") {
      out.push({
        key: "children",
        label: "children",
        type: "string",
        default: "Preview",
        placeholder: "Text content",
      });
      continue;
    }
    if (isLikelyBooleanProp(key)) {
      out.push({ key, label: key, type: "boolean", default: false });
    } else {
      out.push({
        key,
        label: key,
        type: "string",
        default: defaultStringForProp(key),
        placeholder: key,
      });
    }
  }
  return out;
}

const controlOverrides: Record<string, PlaygroundControl[]> = {
  LegacyButton: [
    {
      key: "children",
      label: "children",
      type: "string",
      default: "Preview",
      placeholder: "Text content",
    },
    {
      key: "variant",
      label: "variant",
      type: "select",
      default: "primary",
      options: [
        { value: "primary", label: "primary" },
        { value: "secondary", label: "secondary" },
        { value: "danger", label: "danger" },
        { value: "success", label: "success" },
        { value: "warning", label: "warning" },
        { value: "ghost", label: "ghost" },
      ],
    },
    {
      key: "size",
      label: "size",
      type: "select",
      default: "md",
      options: [
        { value: "sm", label: "sm" },
        { value: "md", label: "md" },
        { value: "lg", label: "lg" },
      ],
    },
  ],
};

function controlsForSpec(id: string, declaredProps: string[]): PlaygroundControl[] {
  const override = controlOverrides[id];
  if (override) return override;
  return controlsFromDeclaredProps(declaredProps);
}

function valuesToComponentProps(
  declaredProps: string[],
  values: PlaygroundArgs,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const key of declaredProps) {
    if (key === "key" || key === "ref") continue;
    if (key === "children") {
      const v = values.children;
      o[key] = v !== undefined && v !== null && String(v).length > 0 ? String(v) : "Preview";
      continue;
    }
    if (isLikelyBooleanProp(key)) {
      o[key] = Boolean(values[key]);
      continue;
    }
    o[key] = values[key];
  }
  return o;
}

function mergeStaticDefaults(
  fromValues: Record<string, unknown>,
  staticDefaults: Record<string, unknown>,
): Record<string, unknown> {
  const o = { ...fromValues };
  for (const [k, v] of Object.entries(staticDefaults)) {
    const cur = o[k];
    if (cur === undefined || cur === "") o[k] = v;
  }
  return o;
}

function getExport(
  mod: Record<string, unknown>,
  exportName: string,
): ComponentType<Record<string, unknown>> | undefined {
  const x = mod[exportName];
  if (typeof x === "function") return x as ComponentType<Record<string, unknown>>;
  return undefined;
}

function jsxTextOrStringifyExpression(text: string): string {
  if (!/[<>{}&]/.test(text)) return text;
  return `{JSON.stringify(${JSON.stringify(text)})}`;
}

function genericUsageSnippet(exportName: string, values: PlaygroundArgs): string {
  const hasChildrenKey = Object.prototype.hasOwnProperty.call(values, "children");
  const childVal = hasChildrenKey ? values.children : undefined;

  const propKeys = Object.keys(values)
    .filter((k) => k !== "children")
    .sort((a, b) => a.localeCompare(b));
  const propsStr = propKeys.map((k) => `${k}={${JSON.stringify(values[k])}}`).join(" ");

  const openWithProps = propKeys.length === 0 ? `<${exportName}` : `<${exportName} ${propsStr}`;

  if (!hasChildrenKey) {
    return propKeys.length === 0 ? `<${exportName} />` : `${openWithProps} />`;
  }

  if (typeof childVal === "boolean") {
    const allKeys = Object.keys(values).sort((a, b) => a.localeCompare(b));
    const allProps = allKeys.map((k) => `${k}={${JSON.stringify(values[k])}}`).join(" ");
    return allKeys.length === 0 ? `<${exportName} />` : `<${exportName} ${allProps} />`;
  }

  const asText = typeof childVal === "number" ? String(childVal) : String(childVal ?? "");
  if (asText.length === 0) {
    return propKeys.length === 0 ? `<${exportName} />` : `${openWithProps} />`;
  }

  const body = jsxTextOrStringifyExpression(asText);
  return propKeys.length === 0
    ? `<${exportName}>${body}</${exportName}>`
    : `${openWithProps}>${body}</${exportName}>`;
}

/** Build playground entries from `dslint-report.json` + eager component modules. */
export function buildPlaygroundEntries(
  report: WorkspaceReport | null | undefined,
): PlaygroundEntry[] {
  const specs = report?.playgrounds;
  if (!specs?.length) return [];

  const out: PlaygroundEntry[] = [];
  for (const spec of specs) {
    const globKey = relPathToGlobKey(spec.rel_path);
    const mod = modules[globKey];
    if (!mod) continue;
    const Cmp = getExport(mod, spec.export_name);
    if (!Cmp) continue;
    const PreviewComponent = Cmp;

    const declared = spec.declared_props ?? [];
    const controls = controlsForSpec(spec.id, declared);
    const staticDefaults = playgroundStaticDefaults[spec.id] ?? {};

    function Preview({ values }: { values: PlaygroundArgs }) {
      const fromValues = valuesToComponentProps(declared, values);
      const merged = mergeStaticDefaults(fromValues, staticDefaults);
      return createElement(PreviewComponent, merged);
    }

    const meta: PlaygroundMeta = {
      id: spec.id,
      title: spec.id,
      ...(spec.group ? { group: spec.group } : {}),
    };

    out.push({
      id: spec.id,
      meta,
      modulePath: globKey,
      controls,
      usageSnippet: (values) => genericUsageSnippet(spec.export_name, values),
      Preview: Preview as PlaygroundPreviewComponent,
    });
  }

  out.sort((a, b) => {
    const ga = a.meta.group ?? "";
    const gb = b.meta.group ?? "";
    if (ga !== gb) return ga.localeCompare(gb);
    return a.meta.title.localeCompare(b.meta.title);
  });
  return out;
}
