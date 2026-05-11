/**
 * Vite still runs PostCSS on CSS. Do not register `tailwindcss` here — Tailwind v4 is
 * handled only by `@tailwindcss/vite` in `vite.config.ts`. A PostCSS `tailwindcss`
 * plugin (v3) will try to parse `node_modules/tailwindcss/index.css` and throw:
 * "`@layer base` is used but no matching `@tailwind base` directive is present."
 */
export default {
  plugins: [],
};
