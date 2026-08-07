/** Tailwind screen breakpoints (min-width), matching usemods `detectBreakpoint`. */
export const SCREEN_WIDTH_PRESETS = [
  { label: "xs", width: 375 },
  { label: "sm", width: 640 },
  { label: "md", width: 768 },
  { label: "lg", width: 1024 },
  { label: "xl", width: 1280 },
  { label: "2xl", width: 1536 },
] as const;

/**
 * Tailwind `@container` mins. Preset widths are the min-width for each name so
 * `@5xl:` styles apply when that option is selected.
 */
export const CONTAINER_WIDTH_PRESETS = [
  { label: "@xs", width: 320 },
  { label: "@sm", width: 384 },
  { label: "@md", width: 448 },
  { label: "@lg", width: 512 },
  { label: "@xl", width: 576 },
  { label: "@2xl", width: 672 },
  { label: "@3xl", width: 768 },
  { label: "@4xl", width: 896 },
  { label: "@5xl", width: 1024 },
  { label: "@6xl", width: 1152 },
  { label: "@7xl", width: 1280 },
] as const;

export type ScreenBreakpointLabel = (typeof SCREEN_WIDTH_PRESETS)[number]["label"];
export type ContainerBreakpointLabel =
  (typeof CONTAINER_WIDTH_PRESETS)[number]["label"];

/** Same thresholds as usemods `detectBreakpoint`, but for an arbitrary width. */
export function screenBreakpointForWidth(width: number): ScreenBreakpointLabel {
  if (width < 640) return "xs";
  if (width < 768) return "sm";
  if (width < 1024) return "md";
  if (width < 1280) return "lg";
  if (width < 1536) return "xl";
  return "2xl";
}

/** Active Tailwind `@container` name for a given width (min-width semantics). */
export function containerBreakpointForWidth(
  width: number,
): ContainerBreakpointLabel {
  if (width >= 1280) return "@7xl";
  if (width >= 1152) return "@6xl";
  if (width >= 1024) return "@5xl";
  if (width >= 896) return "@4xl";
  if (width >= 768) return "@3xl";
  if (width >= 672) return "@2xl";
  if (width >= 576) return "@xl";
  if (width >= 512) return "@lg";
  if (width >= 448) return "@md";
  if (width >= 384) return "@sm";
  return "@xs";
}
