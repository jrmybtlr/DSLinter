# DSLinter demo (Vite + React + TypeScript + Tailwind CSS v4)

This folder is a **small design-system sandbox**: ten components follow theme tokens and common UX conventions; ten illustrate drift (hardcoded colors, missing `alt`, duplicate `Card` definitions, oversized prop surfaces, deprecated names).

Styling uses **Tailwind CSS v4** with the **Vite plugin** (`@tailwindcss/vite`): `src/index.css` imports Tailwind, registers `@source` for `packages/dashboard/src`, and pulls in **`@import "@dslinter/dashboard/theme.css"`** (shadcn/ui tokens + DSLinter layout tokens from the package). There is no `tailwind.config.js`. **`postcss.config.js` intentionally does not load the `tailwindcss` PostCSS plugin** (that is the v3 path and breaks v4’s `index.css`).

This repo uses **workspace linking** at the repo root so every dependency declared by `@dslinter/dashboard` is installed once and TypeScript can resolve it from `demo/`:

- **npm:** `package.json` at the repo root has `"workspaces": ["demo", "packages/dashboard"]`.
- **pnpm:** `pnpm-workspace.yaml` lists the same packages. `demo` links the dashboard with **`"file:../packages/dashboard"`** (a bare `"*"` would hit the public npm registry and 404).

## `@dslinter/dashboard` package

The dashboard UI (sidebar, hash routing, token wall, governance panels) lives in [`../packages/dashboard/`](../packages/dashboard/) and is consumed like a published library:

- **Local:** `demo/package.json` uses `"@dslinter/dashboard": "file:../packages/dashboard"`. Vite is configured with `optimizeDeps.exclude: ["@dslinter/dashboard"]` so edits under `packages/dashboard/src/` hot-reload with `npm run dev` / `pnpm dev` in `demo/`.
- **After publish:** depend on `"@dslinter/dashboard": "^0.0.1"` (or your registry scope) and keep the same **`@import "@dslinter/dashboard/theme.css"`** line after Tailwind in your app CSS.

The demo app wires **data** as follows:

- **`playground/buildRegistry.ts`** — merges `dslint-report.json` → `playgrounds[]` with `import.meta.glob("../components/**/*.tsx")` to resolve live previews (no `definePlayground` in each component file).
- **`playground/playgroundDefaults.ts`** — optional static defaults for previews (e.g. demo image URLs).
- **`tokenCatalog.ts`** — token wall content (keep in sync with `@theme` in `@dslinter/dashboard/theme.css`).
- **`useWorkspaceReport()`** — loads `public/dslint-report.json` and passes `dslinterReport` into `DashboardLayout`.

## Run the UI

From the **repository root** (recommended):

```bash
# npm
npm install && cd demo && npm run dev

# pnpm
pnpm install && cd demo && pnpm dev
```

`npm run dev` is a small wrapper ([scripts/dev.mjs](./scripts/dev.mjs)) that auto-detects whether `cargo` is on `PATH`:

- **Rust installed** — delegates to `npm run dev:serve`: **Vite** (in `--mode serve`) and **`dslint --serve 7878`** concurrently. Vite proxies `/dslint-report.json` and `/events` to the Rust server (see [vite.config.ts](./vite.config.ts)), so the dashboard receives SSE updates the moment a `.tsx` under `src/components/` changes — no manual `npm run dslint:report` step. First boot compiles the dslint binary in release mode (~30s); subsequent runs are instant.
- **Rust missing** — delegates to `npm run dev:vite-only` with a warning. Vite serves the dashboard against the committed `public/dslint-report.json`; that file won't refresh on source changes. Install Rust at <https://rustup.rs> to enable live updates.

| Script | When to use |
|---|---|
| `npm run dev` | Default — auto-detects cargo and picks the right flavor |
| `npm run dev:serve` | Force SSE flavor (errors if cargo isn't installed) |
| `npm run dev:watch` | Polling fallback — Vite hot-reloads when the JSON file is rewritten on a 5s tick (still requires cargo) |
| `npm run dev:vite-only` | Vite alone, no Rust toolchain needed; dashboard reads the committed `public/dslint-report.json` and won't update on source changes |

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
- `#!/tokens` — token wall (from `src/tokenCatalog.ts`, keep in sync with `src/index.css` `@theme`)

### Playgrounds from the dslint CLI (no per-file registration)

The `dslint` scanner emits a **`playgrounds`** array on the workspace report. Each entry includes **`id`** (file stem), **`export_name`**, **`rel_path`**, **`declared_props`**, and optional **`group`** from **`playground_groups`** in [`.dslint.json`](./.dslint.json) (prefix map — longest prefix wins).

The demo joins those rows to Vite modules under `src/components/**` and builds controls from **`declared_props`** (string / boolean heuristics). Optional **`@dslinter/dashboard` `definePlayground`** remains for edge cases, but normal components stay free of dashboard package imports.

### Workspace report (`dslint-report.json`)

Governance and the component sidebar read `public/dslint-report.json`. `npm run dev` keeps it fresh automatically (SSE) — `npm run dslint:report` only matters when `dev` isn't running, e.g. for one-off CI builds, committing a refreshed snapshot, or seeding the file before opening the UI under `dev:vite-only`:

```bash
npm run dslint:report
```

(requires Rust toolchain at repo root — runs `cargo run --release -- demo -p --json`, then `merge-playgrounds` so `playgrounds` is always present.)

If you only have an older JSON file without `playgrounds`, run:

```bash
npm run dslint:merge-playgrounds
```

Then open **Governance** in the browser (or use `#!/governance`). You’ll see governance scores, a component catalog (definitions + usage), the token wall, and findings.

## Run `dslint` against this demo

From the repository root (Rust crate):

```bash
cargo run --release -- demo --json > demo-report.json
# or parallel:
cargo run --release -- -p demo
```

Configuration for this tree lives in `demo/.dslint.json` (deprecated component names, token substring hints for adoption scoring, **`playground_groups`** for the dashboard sidebar).

## What you should see

- **duplicate-component** — two files under `src/components/duplicate/` export `Card`.
- **deprecated-component** — `LegacyButton`, `DeprecatedChip` referenced while listed as deprecated.
- **token-hardcoded-color** — hex values in `FlashBanner`, `InlinePaint`, `LegacyButton`, etc.
- **a11y-img-alt**, **a11y-anchor-href**, **a11y-anchor-placeholder-href**, **a11y-button-name**, **a11y-input-label** — JSX via AST; Vue `<template>` scanned for img / anchor / input (e.g. `MysteryImage`, `<a>` without `href` inside `FlashBanner`).
- **`smell-*` (code quality / maintainability signals)** — `console.log` / etc. (`smell-console`), `console.error` (`smell-console-error`), debugger, lint/ts suppressions, TODO markers, huge files, inline JSX `style={{}}`, empty `catch`, redundant fragments.
- **variant-explosion** — `KitchenSinkModal`’s `PlaygroundPreview` passes many props for the demo.
- **usage rollup** — imports such as `PrimaryButton`, `ContentCard`, `KitchenSinkModal` appear in JSON output.

Tune thresholds and rules in the Rust crate as you harden governance.
