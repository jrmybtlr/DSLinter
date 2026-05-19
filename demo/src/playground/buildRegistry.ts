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
      default: "",
      placeholder: "Preview if empty",
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
  Button: [
    {
      key: "children",
      label: "children",
      type: "string",
      default: "",
      placeholder: "Preview if empty",
    },
    {
      key: "variant",
      label: "variant",
      type: "select",
      default: "white",
      options: [
        { value: "black", label: "black" },
        { value: "dark", label: "dark" },
        { value: "muted", label: "muted" },
        { value: "white", label: "white" },
        { value: "primary", label: "primary" },
        { value: "danger", label: "danger" },
        { value: "gitlab", label: "gitlab" },
        { value: "bitbucket", label: "bitbucket" },
        { value: "nightwatch", label: "nightwatch" },
        { value: "ghost", label: "ghost" },
        { value: "outline", label: "outline" },
        { value: "danger-outline", label: "danger-outline" },
        { value: "icon", label: "icon" },
        { value: "icon-outline", label: "icon-outline" },
      ],
    },
    {
      key: "size",
      label: "size",
      type: "select",
      default: "default",
      options: [
        { value: "small", label: "small" },
        { value: "medium", label: "medium" },
        { value: "default", label: "default" },
        { value: "large", label: "large" },
      ],
    },
    { key: "loading", label: "loading", type: "boolean", default: false },
    { key: "disabled", label: "disabled", type: "boolean", default: false },
  ],
};

const buildWithSkips = createPlaygroundRegistry(modules, {
  controlOverrides,
  staticDefaults: playgroundStaticDefaults,
});

/** Build playground entries from `dslint-report.json` + eager component modules. */
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
