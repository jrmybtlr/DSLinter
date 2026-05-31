import type { PlaygroundControl } from "../types/controls";
import type { ComponentDefinition, PlaygroundSpec, WorkspaceReport } from "../types/report";
import { controlsForSpec } from "./controls";
import {
  inferKitRootPropBindings,
  inferKitJsxSlots,
  slotDefaultFromComponent,
  slotLabelFromComponent,
  type KitJsxSlot,
  type KitRootPropBinding,
} from "./inferKitJsx";
import type { InferredKitParam } from "./inferKitParams";
import { inferKitParams } from "./inferKitParams";
import { expandPlaygroundControls } from "./expandPlaygroundControls";

export type PlaygroundKitHints = {
  rootComponent?: string;
  slots: KitJsxSlot[];
  rootPropBindings: KitRootPropBinding[];
};

function slotForParam(slots: KitJsxSlot[], key: string): KitJsxSlot | undefined {
  return slots.find((slot) => slot.param === key);
}

function enrichOneControl(control: PlaygroundControl, slot: KitJsxSlot | undefined): PlaygroundControl {
  if (!slot) return control;
  const label = slotLabelFromComponent(slot.component);
  const exampleDefault = slotDefaultFromComponent(slot.component);
  const hint = `${slot.component} children`;

  if (control.type === "string") {
    const useExample =
      exampleDefault !== undefined &&
      (control.default === control.key || control.default === control.key.toLowerCase());
    return {
      ...control,
      label,
      hint,
      ...(useExample
        ? { default: exampleDefault, defaultSource: "example" as const, placeholder: exampleDefault }
        : {}),
    };
  }
  return { ...control, label, hint };
}

/** Apply compound slot metadata (labels, example defaults) to inferred controls. */
export function enrichControlsFromKitJsx(
  controls: PlaygroundControl[],
  slots: KitJsxSlot[],
): PlaygroundControl[] {
  return controls.map((control) => enrichOneControl(control, slotForParam(slots, control.key)));
}

function mergeInferredParams(
  params: InferredKitParam[],
  rootPropBindings: KitRootPropBinding[],
): InferredKitParam[] {
  const byKey = new Map(params.map((param) => [param.key, param]));

  for (const binding of rootPropBindings) {
    if (!byKey.has(binding.param)) {
      byKey.set(binding.param, { key: binding.param });
    }
  }

  return [...byKey.values()];
}

function specForCatalog(
  report: { playgrounds?: PlaygroundSpec[] } | null | undefined,
  catalogId: string,
): PlaygroundSpec | undefined {
  return report?.playgrounds?.find(
    (spec) => spec.export_name === catalogId || spec.id === catalogId,
  );
}

function definitionForExport(
  report: WorkspaceReport | null | undefined,
  exportName: string,
): ComponentDefinition | undefined {
  for (const file of report?.files ?? []) {
    const def = file.definitions?.find((d) => d.name === exportName);
    if (def) return def;
  }
  return undefined;
}

function propMetadataForCatalog(
  report: WorkspaceReport | null | undefined,
  catalogId: string,
): {
  spec: PlaygroundSpec;
  propOptions: Record<string, string[]>;
  propDefaults: Record<string, string>;
  propKinds: PlaygroundSpec["declared_prop_kinds"];
} | undefined {
  const spec = specForCatalog(report, catalogId);
  if (!spec || !report) return undefined;

  const def = definitionForExport(report, spec.export_name);
  const propOptions = {
    ...(def?.declared_prop_options ?? {}),
    ...(spec.declared_prop_options ?? {}),
  };
  const propDefaults = {
    ...(def?.declared_prop_defaults ?? {}),
    ...(spec.declared_prop_defaults ?? {}),
  };
  const propKinds = { ...spec.declared_prop_kinds };

  return { spec, propOptions, propDefaults, propKinds };
}

/** Merge typed root props (e.g. CVA `variant`) from the report when the kit binds them. */
export function mergeReportControlsForKit(
  controls: PlaygroundControl[],
  rootPropBindings: KitRootPropBinding[],
  report: WorkspaceReport | null | undefined,
  catalogId: string,
): PlaygroundControl[] {
  const metadata = propMetadataForCatalog(report, catalogId);
  if (!metadata) return controls;

  const { spec, propOptions, propDefaults, propKinds } = metadata;
  const rootBindings = rootPropBindings.filter(
    (binding) => binding.component === spec.export_name || binding.component === catalogId,
  );
  if (rootBindings.length === 0) return controls;

  const boundProps = new Set(rootBindings.map((binding) => binding.prop));
  const reportControls = controlsForSpec(
    catalogId,
    (spec.declared_props ?? []).filter((prop) => boundProps.has(prop)),
    propKinds,
    Object.keys(propOptions).length ? propOptions : undefined,
    Object.keys(propDefaults).length ? propDefaults : undefined,
    {},
    spec.export_name,
  );

  const byKey = new Map(controls.map((control) => [control.key, control]));
  for (const control of reportControls) {
    byKey.set(control.key, control);
  }
  return [...byKey.values()];
}

export function buildKitControls(
  kit: (args: Record<string, unknown>) => unknown,
  options: {
    controls?: Parameters<typeof expandPlaygroundControls>[0];
    defaults?: Record<string, string | number | boolean>;
    report?: { playgrounds?: PlaygroundSpec[] } | null;
    catalogId?: string;
  },
): { controls: PlaygroundControl[]; hints: PlaygroundKitHints } {
  const slots = inferKitJsxSlots(kit);
  const rootPropBindings = inferKitRootPropBindings(kit);
  const params = mergeInferredParams(inferKitParams(kit), rootPropBindings);

  let controls: PlaygroundControl[];
  if (options.controls !== undefined) {
    controls = expandPlaygroundControls(options.controls);
  } else if (options.defaults !== undefined && Object.keys(options.defaults).length > 0) {
    controls = expandPlaygroundControls(options.defaults);
  } else if (params.length > 0) {
    controls = expandPlaygroundControls(
      Object.fromEntries(params.map((param) => [param.key, param.defaultValue ?? param.key])),
    );
  } else {
    controls = [];
  }

  controls = enrichControlsFromKitJsx(controls, slots);

  if (options.catalogId && options.report) {
    controls = mergeReportControlsForKit(
      controls,
      rootPropBindings,
      options.report,
      options.catalogId,
    );
  }

  const rootBinding = rootPropBindings[0];
  return {
    controls,
    hints: {
      rootComponent: rootBinding?.component ?? options.catalogId,
      slots,
      rootPropBindings,
    },
  };
}
