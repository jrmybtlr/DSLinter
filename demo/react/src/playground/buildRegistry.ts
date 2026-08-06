import type { PlaygroundControl, PlaygroundEntry, WorkspaceReport } from "dslinter";
import { createPlaygroundRegistry } from "dslinter";

import { playgroundStaticDefaults } from "./playgroundDefaults";

/** Relative to this file — not `@/` (Vite aliases `@` to the dashboard package for shadcn). */
const modules = import.meta.glob("../components/**/*.{tsx,jsx}", {
  eager: true,
}) as Record<string, Record<string, unknown>>;

const controlOverrides: Record<string, PlaygroundControl[]> = {
  LegacyButton: [
    {
      key: "children",
      label: "children",
      type: "string",
      default: "Example",
      placeholder: "Button label",
    },
    // Defaults only — select options come from report declared_prop_options after merge.
    {
      key: "variant",
      label: "variant",
      type: "select",
      default: "primary",
      options: [],
    },
    {
      key: "size",
      label: "size",
      type: "select",
      default: "md",
      options: [],
    },
  ],
  Button: [
    {
      key: "children",
      label: "children",
      type: "string",
      default: "Example",
      placeholder: "Button label",
    },
    {
      key: "variant",
      label: "variant",
      type: "select",
      default: "white",
      options: [],
    },
    {
      key: "size",
      label: "size",
      type: "select",
      default: "default",
      options: [],
    },
    { key: "loading", label: "loading", type: "boolean", default: false },
    { key: "disabled", label: "disabled", type: "boolean", default: false },
  ],
};

const buildWithSkips = createPlaygroundRegistry(modules, {
  controlOverrides,
  staticDefaults: playgroundStaticDefaults,
});

/** Build playground entries from `dslinter-report.json` + eager component modules. */
export function buildPlaygroundEntries(
  report: WorkspaceReport | null | undefined,
): PlaygroundEntry[] {
  return buildWithSkips(report).entries;
}

/** Skipped joins for inspect-pane diagnostics (`DashboardLayout` → `playgroundJoinSkips`). */
export function getPlaygroundJoinSkips(
  report: WorkspaceReport | null | undefined,
) {
  return buildWithSkips(report).skipped;
}
