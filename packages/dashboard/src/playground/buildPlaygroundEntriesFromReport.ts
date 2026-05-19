import { createElement, type ComponentType } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type { DeclaredPropKind, PlaygroundSpec, WorkspaceReport } from "../types/report";
import type { PlaygroundEntry, PlaygroundMeta, PlaygroundPreviewComponent } from "../types/playground";
import {
  defaultEmbedGlobKeyFromRelPath,
  diagnosePlaygroundJoinSkips,
  logPlaygroundJoinSkips,
  type PlaygroundJoinSkip,
} from "./playgroundJoin";

export type BuildPlaygroundModules = Record<string, Record<string, unknown>>;

export type BuildPlaygroundOptions = {
  /** Maps report `rel_path` to a key in `modules` (from `import.meta.glob`). */
  globKeyFromRelPath?: (relPath: string) => string;
  controlOverrides?: Record<string, PlaygroundControl[]>;
  staticDefaults?: Record<string, Record<string, unknown>>;
  /** When true (default in Vite dev), log specs that failed to join to `modules`. */
  logJoinSkips?: boolean;
};

export type BuildPlaygroundResult = {
  entries: PlaygroundEntry[];
  skipped: PlaygroundJoinSkip[];
};

function defaultGlobKeyFromRelPath(relPath: string): string {
  return defaultEmbedGlobKeyFromRelPath(relPath);
}

export type { PlaygroundJoinSkip, PlaygroundJoinSkipReason } from "./playgroundJoin";
export {
  createConsumerGlobKeyFromRelPath,
  defaultConsumerGlobKeyFromRelPath,
  defaultEmbedGlobKeyFromRelPath,
  diagnosePlaygroundJoinSkips,
  findPlaygroundJoinSkip,
  findPlaygroundSpec,
  logPlaygroundJoinSkips,
} from "./playgroundJoin";

function coerceDeclaredPropKind(v: unknown): DeclaredPropKind | undefined {
  if (v === "boolean" || v === "string" || v === "number" || v === "unknown")
    return v;
  return undefined;
}

function normalizedPropKinds(
  raw: PlaygroundSpec["declared_prop_kinds"],
): Partial<Record<string, DeclaredPropKind>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<Record<string, DeclaredPropKind>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const ck = coerceDeclaredPropKind(v);
    if (ck && ck !== "unknown") out[k] = ck;
  }
  return Object.keys(out).length ? out : undefined;
}

function isLikelyBooleanProp(name: string): boolean {
  const n = name.toLowerCase();
  if (n === "disabled" || n === "loading") return true;
  if (n.startsWith("is") || n.startsWith("has")) return true;
  if (n.startsWith("show") || n.startsWith("hide")) return true;
  return false;
}

function defaultStringForProp(key: string): string {
  if (key === "href") return "#!/governance";
  const k = key.toLowerCase();
  if (
    k === "title" ||
    k === "label" ||
    k === "text" ||
    k === "name" ||
    k === "heading"
  ) {
    return "Label";
  }
  return key;
}

function controlsFromDeclaredProps(
  declaredProps: string[],
  propKinds?: Partial<Record<string, DeclaredPropKind>>,
): PlaygroundControl[] {
  const skip = new Set(["key", "ref"]);
  const out: PlaygroundControl[] = [];
  for (const key of declaredProps) {
    if (skip.has(key)) continue;
    if (key === "children") {
      out.push({
        key: "children",
        label: "children",
        type: "string",
        default: "",
        placeholder: "Preview if empty",
      });
      continue;
    }
    const kind = propKinds?.[key];
    if (kind === "boolean") {
      out.push({ key, label: key, type: "boolean", default: false });
    } else if (kind === "number") {
      out.push({ key, label: key, type: "number", default: 0 });
    } else if (kind === "string") {
      out.push({
        key,
        label: key,
        type: "string",
        default: defaultStringForProp(key),
        placeholder: key,
      });
    } else if (isLikelyBooleanProp(key)) {
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

function controlsForSpec(
  catalogId: string,
  declaredProps: string[],
  propKinds: Partial<Record<string, DeclaredPropKind>> | undefined,
  controlOverrides: Record<string, PlaygroundControl[]>,
): PlaygroundControl[] {
  const override = controlOverrides[catalogId];
  if (override) return override;
  return controlsFromDeclaredProps(declaredProps, propKinds);
}

function valuesToComponentProps(
  declaredProps: string[],
  values: PlaygroundArgs,
  propKinds?: Partial<Record<string, DeclaredPropKind>>,
): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const key of declaredProps) {
    if (key === "key" || key === "ref") continue;
    if (key === "children") {
      const v = values.children;
      o[key] =
        v !== undefined && v !== null && String(v).length > 0
          ? String(v)
          : "Preview";
      continue;
    }
    const kind = propKinds?.[key];
    if (kind === "boolean") {
      o[key] = Boolean(values[key]);
      continue;
    }
    if (kind === "number") {
      const raw = values[key];
      const n = typeof raw === "number" ? raw : Number(raw);
      o[key] = Number.isFinite(n) ? n : 0;
      continue;
    }
    if (kind === "string") {
      o[key] = values[key];
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
  if (typeof x === "function")
    return x as ComponentType<Record<string, unknown>>;
  return undefined;
}

function jsxTextOrStringifyExpression(text: string): string {
  if (!/[<>{}&]/.test(text)) return text;
  return `{JSON.stringify(${JSON.stringify(text)})}`;
}

function valueMatchesPlaygroundDefault(
  control: PlaygroundControl,
  value: string | number | boolean | undefined,
): boolean {
  switch (control.type) {
    case "boolean":
      return Boolean(value) === control.default;
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) && n === control.default;
    }
    case "string":
    case "select":
      return String(value ?? "") === String(control.default);
    default:
      return false;
  }
}

function genericUsageSnippet(
  exportName: string,
  values: PlaygroundArgs,
  controls: PlaygroundControl[],
): string {
  const controlByKey = new Map(controls.map((c) => [c.key, c] as const));

  const emitPropKey = (key: string): boolean => {
    const c = controlByKey.get(key);
    if (!c) return true;
    return !valueMatchesPlaygroundDefault(c, values[key]);
  };

  const hasChildrenKey = Object.prototype.hasOwnProperty.call(
    values,
    "children",
  );
  const childVal = hasChildrenKey ? values.children : undefined;

  const propKeys = Object.keys(values)
    .filter((k) => k !== "children")
    .filter(emitPropKey)
    .sort((a, b) => a.localeCompare(b));
  const propsStr = propKeys
    .map((k) => `${k}={${JSON.stringify(values[k])}}`)
    .join(" ");

  const openWithProps =
    propKeys.length === 0 ? `<${exportName}` : `<${exportName} ${propsStr}`;

  if (!hasChildrenKey) {
    return propKeys.length === 0 ? `<${exportName} />` : `${openWithProps} />`;
  }

  if (typeof childVal === "boolean") {
    const allKeys = Object.keys(values)
      .filter(emitPropKey)
      .sort((a, b) => a.localeCompare(b));
    const allProps = allKeys
      .map((k) => `${k}={${JSON.stringify(values[k])}}`)
      .join(" ");
    return allKeys.length === 0
      ? `<${exportName} />`
      : `<${exportName} ${allProps} />`;
  }

  const asText =
    typeof childVal === "number" ? String(childVal) : String(childVal ?? "");
  if (asText.length === 0) {
    return propKeys.length === 0 ? `<${exportName} />` : `${openWithProps} />`;
  }

  const body = jsxTextOrStringifyExpression(asText);
  return propKeys.length === 0
    ? `<${exportName}>${body}</${exportName}>`
    : `${openWithProps}>${body}</${exportName}>`;
}

/** Sidebar / URL id — matches catalog component names (`export_name`). */
export function playgroundCatalogId(spec: PlaygroundSpec): string {
  return spec.export_name;
}

/** Resolve a catalog name to a loaded playground entry. */
export function resolvePlaygroundEntry(
  entries: PlaygroundEntry[],
  catalogName: string,
): PlaygroundEntry | undefined {
  const byId = entries.find((e) => e.id === catalogName);
  if (byId) return byId;
  return entries.find(
    (e) =>
      e.meta.title === catalogName ||
      e.modulePath.includes(`/${catalogName}.`) ||
      e.modulePath.endsWith(`/${catalogName}.tsx`) ||
      e.modulePath.endsWith(`/${catalogName}.jsx`),
  );
}

/** Build playground entries from report specs + eager Vite modules. */
export function buildPlaygroundEntriesFromReportWithSkips(
  report: WorkspaceReport | null | undefined,
  modules: BuildPlaygroundModules,
  options: BuildPlaygroundOptions = {},
): BuildPlaygroundResult {
  const specs = report?.playgrounds;
  if (!specs?.length) return { entries: [], skipped: [] };

  const globKeyFromRelPath =
    options.globKeyFromRelPath ?? defaultGlobKeyFromRelPath;
  const controlOverrides = options.controlOverrides ?? {};
  const staticDefaultsMap = options.staticDefaults ?? {};

  const skipped = diagnosePlaygroundJoinSkips(report, modules, {
    globKeyFromRelPath,
  });
  const shouldLog =
    options.logJoinSkips ??
    (typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV));
  if (shouldLog) logPlaygroundJoinSkips(skipped);

  const out: PlaygroundEntry[] = [];
  for (const spec of specs) {
    const globKey = globKeyFromRelPath(spec.rel_path);
    const mod = modules[globKey];
    if (!mod) continue;
    const Cmp = getExport(mod, spec.export_name);
    if (!Cmp) continue;

    const catalogId = playgroundCatalogId(spec);
    const declared = spec.declared_props ?? [];
    const propKinds = normalizedPropKinds(spec.declared_prop_kinds);
    const controls = controlsForSpec(
      catalogId,
      declared,
      propKinds,
      controlOverrides,
    );
    const staticDefaults =
      staticDefaultsMap[catalogId] ??
      staticDefaultsMap[spec.id] ??
      {};

    function Preview({ values }: { values: PlaygroundArgs }) {
      const fromValues = valuesToComponentProps(declared, values, propKinds);
      const merged = mergeStaticDefaults(fromValues, staticDefaults);
      return createElement(Cmp, merged);
    }

    const meta: PlaygroundMeta = {
      id: catalogId,
      title: catalogId,
      ...(spec.group ? { group: spec.group } : {}),
    };

    out.push({
      id: catalogId,
      meta,
      modulePath: globKey,
      controls,
      usageSnippet: (values) =>
        genericUsageSnippet(spec.export_name, values, controls),
      Preview: Preview as PlaygroundPreviewComponent,
    });
  }

  out.sort((a, b) => {
    const ga = a.meta.group ?? "";
    const gb = b.meta.group ?? "";
    if (ga !== gb) return ga.localeCompare(gb);
    return a.meta.title.localeCompare(b.meta.title);
  });
  return { entries: out, skipped };
}

/** Build playground entries from report specs + eager Vite modules. */
export function buildPlaygroundEntriesFromReport(
  report: WorkspaceReport | null | undefined,
  modules: BuildPlaygroundModules,
  options: BuildPlaygroundOptions = {},
): PlaygroundEntry[] {
  return buildPlaygroundEntriesFromReportWithSkips(report, modules, options)
    .entries;
}
