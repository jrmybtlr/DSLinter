# DSLint demo (Vite + React + TypeScript + Tailwind)

This folder is a **small design-system sandbox**: ten components follow theme tokens and common UX conventions; ten illustrate drift (hardcoded colors, missing `alt`, duplicate `Card` definitions, oversized prop surfaces, deprecated names).

## `@dslint/workbench` package

The workbench UI (sidebar, hash routing, token wall, governance panels) lives in [`../packages/workbench/`](../packages/workbench/) and is consumed like a published library:

- **Local (same as `npm pack` + install):** `demo/package.json` uses `"@dslint/workbench": "file:../packages/workbench"`. Vite is configured with `optimizeDeps.exclude: ["@dslint/workbench"]` so edits under `packages/workbench/src/` hot-reload with `npm run dev` in `demo/`.
- **After publish:** replace that dependency with `"@dslint/workbench": "^0.0.1"` (or your registry scope).

The demo app wires **data** as follows:

- **`playground/buildRegistry.ts`** — merges `dslint-report.json` → `playgrounds[]` with `import.meta.glob("../components/**/*.tsx")` to resolve live previews (no `definePlayground` in each component file).
- **`playground/playgroundDefaults.ts`** — optional static defaults for previews (e.g. demo image URLs).
- **`tokenCatalog.ts`** — token wall content (keep in sync with `tailwind.config.js`).
- **`useWorkspaceReport()`** — loads `public/dslint-report.json` and passes `dslintReport` into `WorkbenchLayout`.
- **`DemoOverview.tsx`** — custom landing copy for `#!/overview`.

## Run the UI

```bash
cd demo
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Storybook-style playground

The dev app is a single **workbench**: a left sidebar lists isolated component previews, **Design tokens**, and **Governance** (DSLint inventory). Navigation uses the URL hash, for example:

- `#!/overview` — landing copy
- `#!/component/PrimaryButton` — preview id matches the **file stem** listed in `dslint-report.json` → `playgrounds[].id`
- `#!/tokens` — token wall (from `src/tokenCatalog.ts`, keep in sync with `tailwind.config.js`)
- `#!/governance` — scores, catalog, tokens, and findings from `public/dslint-report.json`

### Playgrounds from DSLint (no per-file registration)

DSLint emits a **`playgrounds`** array on the workspace report. Each entry includes **`id`** (file stem), **`export_name`**, **`rel_path`**, **`declared_props`**, and optional **`group`** from **`playground_groups`** in [`.dslint.json`](./.dslint.json) (prefix map — longest prefix wins).

The demo joins those rows to Vite modules under `src/components/**` and builds controls from **`declared_props`** (string / boolean heuristics). Optional **`@dslint/workbench` `definePlayground`** remains for edge cases, but normal components stay free of workbench imports.

### DSLint report

Governance and the component sidebar read `public/dslint-report.json`. Regenerate whenever sources change:

```bash
npm run dslint:report
```

(requires Rust toolchain at repo root — runs `cargo run --release -- demo -p --json`, then `merge-playgrounds` so `playgrounds` is always present.)

If you only have an older JSON file without `playgrounds`, run:

```bash
npm run dslint:merge-playgrounds
```

Then open **Governance** in the browser (or use `#!/governance`). You’ll see governance scores, a component catalog (definitions + usage), the token wall, and findings.

## Run DSLint against this demo

From the repository root (Rust crate):

```bash
cargo run --release -- demo --json > demo-report.json
# or parallel:
cargo run --release -- -p demo
```

Configuration for this tree lives in `demo/.dslint.json` (deprecated component names, token substring hints for adoption scoring, **`playground_groups`** for the workbench sidebar).

## What you should see

- **duplicate-component** — two files under `src/components/duplicate/` export `Card`.
- **deprecated-component** — `LegacyButton`, `DeprecatedChip` referenced while listed as deprecated.
- **token-hardcoded-color** — hex values in `FlashBanner`, `InlinePaint`, `LegacyButton`, etc.
- **a11y-img-alt**, **a11y-anchor-href**, **a11y-anchor-placeholder-href**, **a11y-button-name**, **a11y-input-label** — JSX via AST; Vue `<template>` scanned for img / anchor / input (e.g. `MysteryImage`, `<a>` without `href` inside `FlashBanner`).
- **`smell-*`** — `console.log` / etc. (`smell-console`), `console.error` (`smell-console-error`), debugger, lint/ts suppressions, TODO markers, huge files, inline JSX `style={{}}`, empty `catch`, redundant fragments.
- **variant-explosion** — `KitchenSinkModal`’s `PlaygroundPreview` passes many props for the demo.
- **usage rollup** — imports such as `PrimaryButton`, `ContentCard`, `KitchenSinkModal` appear in JSON output.

Tune thresholds and rules in the Rust crate as you harden governance.
