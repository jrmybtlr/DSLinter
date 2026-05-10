# DSLint demo (Vite + React + TypeScript + Tailwind)

This folder is a **small design-system sandbox**: ten components follow theme tokens and common UX conventions; ten illustrate drift (hardcoded colors, missing `alt`, duplicate `Card` definitions, oversized prop surfaces, deprecated names).

## `@dslint/workbench` package

The workbench UI (sidebar, hash routing, token wall, governance panels) lives in [`../packages/workbench/`](../packages/workbench/) and is consumed like a published library:

- **Local (same as `npm pack` + install):** `demo/package.json` uses `"@dslint/workbench": "file:../packages/workbench"`. Vite is configured with `optimizeDeps.exclude: ["@dslint/workbench"]` so edits under `packages/workbench/src/` hot-reload with `npm run dev` in `demo/`.
- **After publish:** replace that dependency with `"@dslint/workbench": "^0.0.1"` (or your registry scope).

The demo app only wires **data**: `playground/buildRegistry.ts` (`import.meta.glob` over `src/components`), `playground/usageSnippets.ts` (JSX examples from `values`), `tokenCatalog.ts`, `useWorkspaceReport()` → `dslintReport` on `WorkbenchLayout`, and optional `overview` (`DemoOverview.tsx`).

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
- `#!/component/PrimaryButton` — one preview (IDs match `playgroundMeta.id` on the component module)
- `#!/tokens` — token wall (from `src/tokenCatalog.ts`, keep in sync with `tailwind.config.js`)
- `#!/governance` — scores, catalog, tokens, and findings from `public/dslint-report.json`

### Optional playground exports (no extra files)

Any `src/components/**/*.tsx` module can opt into the sidebar by exporting:

- `playgroundMeta` — `{ id, title, section: "good" | "bad", description? }`
- `playgroundControls` — optional array of `{ type: "boolean" | "string" | "number" | "select", key, label, ... }` (omit or `[]` for static previews)
- `PlaygroundPreview` — `function PlaygroundPreview({ values })` where `values` is the live prop bag from the workbench control panel

Components without those exports are omitted from the nav (same idea as DSLint inventory without story files). Vite discovers modules via `import.meta.glob` in `src/playground/buildRegistry.ts` — add the two exports to an existing component file to register a preview; no separate story file to maintain.

### DSLint report

Governance reads `public/dslint-report.json`. Regenerate whenever sources change:

```bash
npm run dslint:report
```

(requires Rust toolchain at repo root — runs `cargo run --release -- demo -p --json`)

Then open **Governance** in the browser (or use `#!/governance`). You’ll see governance scores, a component catalog (definitions + usage), the token wall, and findings.

## Run DSLint against this demo

From the repository root (Rust crate):

```bash
cargo run --release -- demo --json > demo-report.json
# or parallel:
cargo run --release -- -p demo
```

Configuration for this tree lives in `demo/.dslint.json` (deprecated component names, token substring hints for adoption scoring).

## What you should see

- **duplicate-component** — two files under `src/components/bad/duplicate/` export `Card`.
- **deprecated-component** — `LegacyButton`, `DeprecatedChip` referenced while listed as deprecated.
- **token-hardcoded-color** — hex values in `FlashBanner`, `InlinePaint`, `LegacyButton`, etc.
- **a11y-img-alt**, **a11y-anchor-href**, **a11y-anchor-placeholder-href**, **a11y-button-name**, **a11y-input-label** — JSX via AST; Vue `<template>` scanned for img / anchor / input (e.g. `MysteryImage`, `<a>` without `href` inside `FlashBanner`).
- **`smell-*`** — `console.log` / etc. (`smell-console`), `console.error` (`smell-console-error`), debugger, lint/ts suppressions, TODO markers, huge files, inline JSX `style={{}}`, empty `catch`, redundant fragments.
- **variant-explosion** — `KitchenSinkModal`’s `PlaygroundPreview` passes many props for the demo.
- **usage rollup** — imports such as `PrimaryButton`, `ContentCard`, `KitchenSinkModal` appear in JSON output.

Tune thresholds and rules in the Rust crate as you harden governance.
