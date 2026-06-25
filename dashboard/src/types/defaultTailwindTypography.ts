import type {
  TokenCatalogFontFamily,
  TokenCatalogFontSize,
  TokenCatalogFontWeight,
} from "./tokenCatalog";

/** Tailwind v4 default `text-*` scale (font size / line-height pairing is class-level; values are font-size). */
export const defaultTailwindFontSizes = [
  { token: "xs", value: "0.75rem (12px)", tw: "text-xs" },
  { token: "sm", value: "0.875rem (14px)", tw: "text-sm" },
  { token: "base", value: "1rem (16px)", tw: "text-base" },
  { token: "lg", value: "1.125rem (18px)", tw: "text-lg" },
  { token: "xl", value: "1.25rem (20px)", tw: "text-xl" },
  { token: "2xl", value: "1.5rem (24px)", tw: "text-2xl" },
  { token: "3xl", value: "1.875rem (30px)", tw: "text-3xl" },
  { token: "4xl", value: "2.25rem (36px)", tw: "text-4xl" },
  { token: "5xl", value: "3rem (48px)", tw: "text-5xl" },
  { token: "6xl", value: "3.75rem (60px)", tw: "text-6xl" },
  { token: "7xl", value: "4.5rem (72px)", tw: "text-7xl" },
  { token: "8xl", value: "6rem (96px)", tw: "text-8xl" },
  { token: "9xl", value: "8rem (128px)", tw: "text-9xl" },
] as const satisfies readonly TokenCatalogFontSize[];

export const defaultTailwindFontWeights = [
  { token: "thin", tw: "font-thin", value: "100" },
  { token: "extralight", tw: "font-extralight", value: "200" },
  { token: "light", tw: "font-light", value: "300" },
  { token: "normal", tw: "font-normal", value: "400" },
  { token: "medium", tw: "font-medium", value: "500" },
  { token: "semibold", tw: "font-semibold", value: "600" },
  { token: "bold", tw: "font-bold", value: "700" },
  { token: "extrabold", tw: "font-extrabold", value: "800" },
  { token: "black", tw: "font-black", value: "900" },
] as const satisfies readonly TokenCatalogFontWeight[];

/** Stacks aligned with Tailwind’s default theme fonts — keep in sync with host `@theme --font-*`. */
export const defaultTailwindFontFamilies = [
  {
    key: "sans",
    tw: "font-sans",
    value:
      'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  },
  {
    key: "serif",
    tw: "font-serif",
    value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  },
  {
    key: "mono",
    tw: "font-mono",
    value:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
] as const satisfies readonly TokenCatalogFontFamily[];
