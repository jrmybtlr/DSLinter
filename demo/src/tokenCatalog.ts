import type { TokenCatalog } from "@dslinter/dashboard";
import {
  defaultTailwindFontFamilies,
  defaultTailwindFontSizes,
  defaultTailwindFontWeights,
} from "@dslinter/dashboard";

/**
 * Mirrors `@theme` in `src/index.css` + `@dslinter/dashboard/theme.css` for the dashboard token wall.
 * Keep colors/spacing/radius in sync when you change design tokens.
 * Typography stacks should match `--font-sans`, `--font-serif`, `--font-mono` when you override them.
 */
export const tokenCatalog = {
  colors: [
    { token: "primary", shade: "DEFAULT", value: "#2563eb", tw: "bg-primary" },
    { token: "primary", shade: "foreground", value: "#ffffff", tw: "text-primary-foreground" },
    { token: "primary", shade: "muted", value: "#93c5fd", tw: "text-primary-muted" },
    { token: "surface", shade: "DEFAULT", value: "#f8fafc", tw: "bg-surface" },
    { token: "surface", shade: "elevated", value: "#ffffff", tw: "bg-surface-elevated" },
    { token: "surface", shade: "border", value: "#e2e8f0", tw: "border-surface-border" },
    { token: "danger", shade: "DEFAULT", value: "#dc2626", tw: "text-danger" },
    { token: "danger", shade: "foreground", value: "#fef2f2", tw: "bg-danger-foreground" },
  ],
  spacing: [
    { token: "layout-xs", value: "0.5rem", tw: "p-layout-xs" },
    { token: "layout-sm", value: "1rem", tw: "p-layout-sm" },
    { token: "layout-md", value: "1.5rem", tw: "p-layout-md" },
    { token: "layout-lg", value: "2rem", tw: "p-layout-lg" },
  ],
  radius: [
    { token: "ds", value: "0.5rem", tw: "rounded-ds" },
    { token: "ds-lg", value: "0.75rem", tw: "rounded-ds-lg" },
  ],
  typography: {
    families: [...defaultTailwindFontFamilies],
    sizes: [...defaultTailwindFontSizes],
    weights: [...defaultTailwindFontWeights],
  },
} as const satisfies TokenCatalog;
