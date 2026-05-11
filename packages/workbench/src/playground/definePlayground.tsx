import type { ComponentType, ReactNode } from "react";
import type { PlaygroundArgs, PlaygroundControl } from "../types/controls";
import type { PlaygroundMeta } from "../types/playground";
import type { PlaygroundPreviewComponent, PlaygroundPreviewProps } from "../types/preview";

export type DefinedPlayground = {
  playgroundMeta: PlaygroundMeta;
  playgroundControls: PlaygroundControl[];
  PlaygroundPreview: PlaygroundPreviewComponent;
};

type PlaygroundDefinitionBase = {
  /**
   * Stable sidebar / URL id. Defaults to the component’s `displayName` or function `name`
   * (dev builds). Required for `render`-only definitions or when the name is unreliable.
   */
  id?: string;
  title?: string;
  /** Sidebar / report group (e.g. from dslint `playground_groups`). */
  group?: string;
  /** @deprecated Use `group` — kept for older call sites. */
  section?: string;
  controls?: PlaygroundControl[];
};

type DefineWithComponent<P> = PlaygroundDefinitionBase & {
  /** Map control values to props for the preview component. */
  props: (values: PlaygroundArgs) => P;
};

type DefineWithRender = PlaygroundDefinitionBase & {
  /** Use when the preview is not a straight prop pass (composition, static demos, wrappers). */
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

function resolveMeta(base: PlaygroundDefinitionBase, nameFallback: string | undefined): PlaygroundMeta {
  const id = base.id ?? inferId(nameFallback);
  const title = base.title ?? id;
  const group = base.group ?? base.section;
  return {
    id,
    title,
    ...(group !== undefined && group !== "" ? { group } : {}),
  };
}

/**
 * Optional escape hatch: declare workbench playground exports manually. Prefer driving
 * playgrounds from `dslint-report.json` (`playgrounds`) so component files stay free of
 * workbench imports.
 */
export function definePlayground<P extends Record<string, unknown>>(
  component: ComponentType<P>,
  options: DefineWithComponent<P>,
): DefinedPlayground;

export function definePlayground(options: DefineWithRender): DefinedPlayground;

export function definePlayground<P extends Record<string, unknown>>(
  componentOrOptions: ComponentType<P> | DefineWithRender,
  options?: DefineWithComponent<P>,
): DefinedPlayground {
  if (options !== undefined) {
    const Component = componentOrOptions as ComponentType<P>;
    const opts = options;
    const meta = resolveMeta(opts, getComponentLabel(Component));
    const controls = opts.controls ?? [];
    function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
      return <Component {...opts.props(values)} />;
    }
    PlaygroundPreview.displayName = `${meta.id}PlaygroundPreview`;
    return { playgroundMeta: meta, playgroundControls: controls, PlaygroundPreview };
  }

  const opts = componentOrOptions as DefineWithRender;
  const meta = resolveMeta(opts, undefined);
  const controls = opts.controls ?? [];
  function PlaygroundPreview({ values }: PlaygroundPreviewProps) {
    return <>{opts.render(values)}</>;
  }
  PlaygroundPreview.displayName = `${meta.id}PlaygroundPreview`;
  return { playgroundMeta: meta, playgroundControls: controls, PlaygroundPreview };
}
