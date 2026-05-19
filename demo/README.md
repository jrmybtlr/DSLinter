# DSLinter demo (Vite + React + TypeScript + Tailwind CSS v4)

This folder is a **small design-system sandbox**: ten components follow theme tokens and common UX conventions; ten illustrate drift (hardcoded colors, missing `alt`, duplicate `Card` definitions, oversized prop surfaces, deprecated names).

Styling uses **Tailwind CSS v4** with the **Vite plugin** (`@tailwindcss/vite`): `src/index.css` imports Tailwind, registers `@source` for `packages/dashboard/src`, and pulls in **`@import "dslinter/theme.css"`** (shadcn/ui tokens + DSLinter layout tokens from the package). There is no `tailwind.config.js`. **`postcss.config.js` intentionally does not load the `tailwindcss` PostCSS plugin** (that is the v3 path and breaks v4’s `index.css`).

This repo uses **workspace linking** at the repo root so every dependency declared by `dslinter` is installed once and TypeScript can resolve it from `demo/`:

- **npm:** `package.json` at the repo root has `"workspaces": ["demo", "packages/dashboard"]`.
- **pnpm:** `pnpm-workspace.yaml` lists the same packages. `demo` links the dashboard with **`"file:../packages/dashboard"`** (a bare `"*"` would hit the public npm registry and 404).

## `dslinter` package

The dashboard UI (sidebar, hash routing, token wall, governance panels) lives in [`../packages/dashboard/`](../packages/dashboard/) and is consumed like a published library:

- **Local:** `demo/package.json` uses `"dslinter": "workspace:*"`. Vite aliases `dslinter` to `packages/dashboard/src` (and `optimizeDeps.exclude: ["dslinter"]`) so edits hot-reload without reinstalling when new modules are added.
- **After publish:** depend on `"dslinter": "^0.0.1"` (or your registry scope) and keep the same **`@import "dslinter/theme.css"`** line after Tailwind in your app CSS.

The demo app wires **data** as follows:

- **`playground/buildRegistry.ts`** — merges `dslint-report.json` → `playgrounds[]` with `import.meta.glob("../components/**/*.{tsx,jsx}")` via `createPlaygroundRegistry` from **dslinter** (covers nested paths like `src/components/ui/button.tsx`). Passes `playgroundJoinSkips` to the dashboard for inspect-pane hints when a preview fails to load.
- **`playground/playgroundDefaults.ts`** — optional static defaults for previews (e.g. demo image URLs).
- **`tokenCatalog.ts`** — optional Tailwind utility hints for the token wall; CSS variables are discovered automatically from `dslint-report.json` → `css_tokens`.
- **`useWorkspaceReport()`** — loads `public/dslint-report.json` and passes `dslinterReport` into `DashboardLayout`.

## Run the UI

From the **repository root** (recommended):

```bash
# npm
npm install && cd demo && npm run dev

# pnpm
pnpm install && cd demo && pnpm dev
```

`npm run dev` runs **`dslinter`** ([scripts/dev.mjs](./scripts/dev.mjs)): watch + scanner HTTP on **7878** + Vite (`--mode serve`). Vite proxies `/dslint-report.json` and `/events` (see [vite.config.ts](./vite.config.ts)) so the dashboard updates over **SSE**.

Equivalent from `demo/`: `npx dslinter .`

| Script                  | When to use                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| `npm run dev`           | Default — `dslinter` dev mode                                        |
| `npm run dev:serve`     | Scanner only (`dslinter --serve 7878`)                               |
| `npm run dev:watch`     | Watch JSON only (`dslinter --watch`)                                 |
| `npm run dev:vite-only` | Vite alone; static committed report                                  |

**pnpm:** Prefer **`pnpm install` from the repo root** (predictable, one lockfile). Running `pnpm install` from `demo/` still picks up the parent `pnpm-workspace.yaml` and scopes all workspace packages, but pnpm may **prompt** to wipe and reinstall `node_modules` (non-interactive shells can appear to hang — use root installs or `CI=true pnpm install` in CI).

With **npm**, `cd demo && npm install` still discovers the root `package.json` workspaces.

Build:

```bash
cd demo && npm run build
```

## Storybook-style playground

The dev app is a single **dashboard**: a left sidebar lists isolated component previews, **Design tokens**, and **Governance** (DSLinter inventory). Navigation uses the URL hash, for example:

- `#!/governance` — default landing: package intro plus scores, catalog, tokens, and findings from `public/dslint-report.json`
- `#!/component/PrimaryButton` — preview id matches the **file stem** listed in `dslint-report.json` → `playgrounds[].id`
- `#!/tokens` — token wall (scanned from `src/index.css` + `dslinter/theme.css`; `tokenCatalog.ts` enriches utility names when present)

### Playgrounds from the dslint CLI (no per-file registration)

The `dslint` scanner emits a **`playgrounds`** array on the workspace report. Each entry includes **`id`** (file stem), **`export_name`**, **`rel_path`**, **`declared_props`**, and optional **`group`** from **`playground_groups`** in [`.dslint.json`](./.dslint.json) (prefix map — longest prefix wins).

The demo joins those rows to Vite modules under `src/components/**` and builds controls from **`declared_props`** (string / boolean heuristics). Optional **`definePlayground()`** from **dslinter** remains for edge cases, but normal components stay free of dashboard package imports.

### Workspace report (`dslint-report.json`)

Governance and the component sidebar read `public/dslint-report.json`. `npm run dev` keeps it fresh automatically (SSE) — `npm run dslint:report` only matters when `dev` isn't running, e.g. for one-off CI builds, committing a refreshed snapshot, or seeding the file before opening the UI under `dev:vite-only`:

```bash
npm run dslint:report
```

(uses [run-dslint.mjs](./scripts/run-dslint.mjs) — prebuilt `dslinter` or `cargo run` for contributors — then `merge-playgrounds` so `playgrounds` is always present.)

If you only have an older JSON file without `playgrounds`, run:

```bash
npm run dslint:merge-playgrounds
```

Then open **Governance** in the browser (or use `#!/governance`). You’ll see governance scores, a component catalog (definitions + usage), the token wall, and findings.

## Run `dslint` against this demo

From the repository root:

```bash
npx dslinter demo --json > demo-report.json
# or parallel:
npx dslinter -p demo
```

Contributors without npm can use `cargo run --release --bin dslinter -- demo --json`.

Configuration for this tree lives in `demo/.dslint.json` (deprecated component names, token substring hints for adoption scoring, **`playground_groups`** for the dashboard sidebar).

## What you should see

- **duplicate-component** — two files under `src/components/duplicate/` export `Card`.
- **deprecated-component** — `LegacyButton`, `DeprecatedChip` referenced while listed as deprecated.
- **token-hardcoded-color** — hex values in `FlashBanner`, `InlinePaint`, `LegacyButton`, etc.
- **a11y-img-alt**, **a11y-anchor-href**, **a11y-anchor-placeholder-href**, **a11y-button-name**, **a11y-input-label** — JSX via AST; Vue `<template>` scanned for img / anchor / input (e.g. `MysteryImage`, `<a>` without `href` inside `FlashBanner`).
- **`code-*` (code quality / maintainability signals)** — `console.log` / etc. (`code-console`), `console.error` (`code-console-error`), debugger, lint/ts suppressions, TODO markers, huge files, inline JSX `style={{}}`, empty `catch`, redundant fragments.
- **variant-explosion** — `KitchenSinkModal`’s `PlaygroundPreview` passes many props for the demo.
- **usage rollup** — imports such as `PrimaryButton`, `ContentCard`, `KitchenSinkModal` appear in JSON output.

Tune thresholds and rules in the Rust crate as you harden governance.
