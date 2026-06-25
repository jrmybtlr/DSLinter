import type { ComponentType, ReactNode } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import { buildKitControls, type PlaygroundKitHints } from "./enrichKitControls";
import {
  expandPlaygroundControls,
  propsFromControls,
  type PlaygroundControlsInput,
} from "./expandPlaygroundControls";
import type { PlaygroundMeta } from "../types/playground";
import type { PlaygroundPreviewComponent, PlaygroundPreviewProps } from "../types/preview";

export type DefinedPlayground = {
  playgroundMeta: PlaygroundMeta;
  playgroundControls: PlaygroundControl[];
  PlaygroundPreview: PlaygroundPreviewComponent;
  playgroundKitHints?: PlaygroundKitHints;
};

type PlaygroundDefinitionBase = {
  /**
   * Stable sidebar / URL id. Defaults to the component’s `displayName` or function `name`
   * (dev builds). For `render`-only definitions, omit when the module export is
   * `{name}Playground` (resolved at collect time).
   */
  id?: string;
  title?: string;
  /** Sidebar / report group (e.g. from dslint `playground_groups`). */
  group?: string;
  /** @deprecated Use `group` — kept for older call sites. */
  section?: string;
  controls?: PlaygroundControlsInput;
};

type PlaygroundMetaOptions = Omit<PlaygroundDefinitionBase, "controls"> & {
  controls?: PlaygroundControlsInput;
};

type DefineWithComponent<P> = PlaygroundDefinitionBase & {
  /** Map control values to props for the preview component. */
  props: (values: PlaygroundArgs) => P;
};

type DefineWithKit<T extends PlaygroundArgs = PlaygroundArgs> = PlaygroundDefinitionBase & {
  /** Preview renderer receiving mapped control values. */
  kit: (args: T) => ReactNode;
  /** Optional overrides merged after inferred / declared control defaults. */
  defaults?: Partial<T>;
};

type DefineWithRender = PlaygroundDefinitionBase & {
  /** Escape hatch when `kit` control mapping is not enough (raw panel values, legacy call sites). */
  render: (values: PlaygroundArgs) => ReactNode;
};

function getComponentLabel(Component: unknown): string | undefined {
  if (typeof Component !== "function") return undefined;
  const fn = Component as { displayName?: string; name?: string };
  return fn.displayName ?? fn.name;
}

function inferId(nameFallback: string | undefined): string {
  if (nameFallback && nameFallback.length > 0) return nameFallback;
  throw new Error(
    "definePlayground: set `id` in options when the component has no usable `name` / `displayName`, or when using a `render`-only definition.",
  );
}

function resolveMeta(
  base: PlaygroundDefinitionBase,
  nameFallback: string | undefined,
): PlaygroundMeta {
  const id = base.id ?? (nameFallback ? inferId(nameFallback) : "");
  const title = base.title ?? (id || "");
  const group = base.group ?? base.section;
  return {
    id,
    title,
    ...(group !== undefined && group !== "" ? { group } : {}),
  };
}

function resolveKitControls(
  kit: (args: PlaygroundArgs) => ReactNode,
  opts: PlaygroundDefinitionBase & { defaults?: Partial<PlaygroundArgs> },
  catalogId: string,
): { controls: PlaygroundControl[]; hints: PlaygroundKitHints } {
  return buildKitControls(kit, {
    controls: opts.controls,
    defaults: opts.defaults as Record<string, string | number | boolean> | undefined,
    catalogId: catalogId || undefined,
  });
}

function buildKitPlayground<T extends PlaygroundArgs>(
  kit: (args: T) => ReactNode,
  opts: PlaygroundDefinitionBase & { defaults?: Partial<T> },
): DefinedPlayground {
  const meta = resolveMeta(opts, undefined);
  const { controls, hints } = resolveKitControls(kit, opts, meta.id);
  function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
    return <>{kit(propsFromControls(controls, values, opts.defaults))}</>;
  }
  PlaygroundPreview.displayName = `${meta.id}PlaygroundPreview`;
  return {
    playgroundMeta: meta,
    playgroundControls: controls,
    PlaygroundPreview,
    playgroundKitHints: hints,
  };
}

function isComponentPropsOptions(value: unknown): value is DefineWithComponent<Record<string, unknown>> {
  return typeof value === "object" && value !== null && "props" in value;
}

/**
 * Declare dashboard playground exports manually. Pass a kit callback directly — control
 * keys are inferred from destructured parameters (inline defaults become panel defaults).
 */
export function definePlayground<P extends Record<string, unknown>>(
  component: ComponentType<P>,
  options: DefineWithComponent<P>,
): DefinedPlayground;

export function definePlayground<T extends PlaygroundArgs>(
  kit: (args: T) => ReactNode,
  meta?: PlaygroundMetaOptions & { defaults?: Partial<T> },
): DefinedPlayground;

export function definePlayground<T extends PlaygroundArgs>(
  options: DefineWithKit<T>,
): DefinedPlayground;

export function definePlayground(options: DefineWithRender): DefinedPlayground;

export function definePlayground<P extends Record<string, unknown>, T extends PlaygroundArgs>(
  componentOrKitOrOptions: ComponentType<P> | ((args: T) => ReactNode) | DefineWithKit<T> | DefineWithRender,
  options?: DefineWithComponent<P> | (PlaygroundMetaOptions & { defaults?: Partial<T> }),
): DefinedPlayground {
  if (typeof componentOrKitOrOptions === "function" && isComponentPropsOptions(options)) {
    const Component = componentOrKitOrOptions as ComponentType<P>;
    const opts = options;
    const meta = resolveMeta(opts, getComponentLabel(Component));
    const controls = expandPlaygroundControls(opts.controls);
    function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
      return <Component {...opts.props(values)} />;
    }
    PlaygroundPreview.displayName = `${meta.id}PlaygroundPreview`;
    return { playgroundMeta: meta, playgroundControls: controls, PlaygroundPreview };
  }

  if (typeof componentOrKitOrOptions === "function") {
    const kit = componentOrKitOrOptions as (args: T) => ReactNode;
    return buildKitPlayground(kit, options ?? {});
  }

  const opts = componentOrKitOrOptions as DefineWithKit<T> | DefineWithRender;
  if ("kit" in opts) {
    return buildKitPlayground(opts.kit, opts);
  }

  const meta = resolveMeta(opts, undefined);
  const controls = expandPlaygroundControls(opts.controls);
  function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
    return <>{opts.render(values)}</>;
  }
  PlaygroundPreview.displayName = `${meta.id}PlaygroundPreview`;
  return { playgroundMeta: meta, playgroundControls: controls, PlaygroundPreview };
}

export type { DefineWithKit as DefinePlaygroundKitOptions, PlaygroundKitHints };
