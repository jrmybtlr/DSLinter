# DSLint demo (Vite + React + TypeScript + Tailwind)

This folder is a **small design-system sandbox**: ten components follow theme tokens and common UX conventions; ten illustrate drift (hardcoded colors, missing `alt`, duplicate `Card` definitions, oversized prop surfaces, deprecated names).

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

## Storybook-style dashboard

The dev app has two tabs: **Gallery** (live components) and **Dashboard** (inventory from DSLint).

The dashboard reads `public/dslint-report.json`. Refresh that file whenever sources change:

```bash
npm run dslint:report
```

(requires Rust toolchain at repo root — runs `cargo run --release -- demo -p --json`)

Then open **Dashboard** in the browser. You’ll see governance scores, a component catalog (definitions + usage), the token wall (mirrors `tailwind.config.js`), and top findings.

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
- **variant-explosion** — `App.tsx` passes many props to `KitchenSinkModal`.
- **usage rollup** — imports such as `PrimaryButton`, `ContentCard`, `KitchenSinkModal` appear in JSON output.

Tune thresholds and rules in the Rust crate as you harden governance.
