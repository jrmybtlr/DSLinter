# DSLint

A Rust CLI that scans a repo for **JSX, TSX, and Vue** components, counts **how often each is used** (Storybook-style visibility without story files), and reports **design-system health** signals you can use in the terminal, CI, or a dashboard.

## Quick start

```bash
cargo build --release
./target/release/dslint /path/to/repo               # summary for humans
./target/release/dslint /path/to/repo --json       # JSON for tools / CI
./target/release/dslint -p /path/to/repo           # parallel scan (large trees)
./target/release/dslint /path/to/repo --fail-on-warnings
./target/release/dslint /path/to/repo --max-warnings 10
```

## What gets scanned

- **Respects ignores:** `.gitignore` and `.dslintignore` at the repo root (globset semantics; **last matching rule wins**, including `!` negation; use `\!` for a literal `!`). Optional `exclude_globs` in config apply too.
- **Inline suppressions:** On the line above a finding, use `// dslint-ignore-next-line rule-id` (comma-separated rules; `*` or `prefix*` allowed). That line only suppresses the **next** source line.
- **Overlap:** If **`token-hardcoded-color`** and **`token-tailwind-arbitrary`** both hit the same line, only the Tailwind rule is reported.

## Config (optional)

Put `.dslint.json` or `dslint.json` at the repository root:

```json
{
  "deprecated_components": ["LegacyButton"],
  "known_tokens": ["--color-", "spacing.", "theme."],
  "ownership": {
    "design-system": ["packages/ui/", "src/ds/"]
  },
  "exclude_globs": ["fixtures/**", "*.generated.tsx"],
  "smell": {
    "disabled_rules": ["smell-todo-marker"],
    "report_console_error": true
  },
  "check_dark_mode_contrast": false
}
```

`check_dark_mode_contrast` is **heuristic**: it looks at static `class` / `className` strings and quoted literals inside `cn(...)`, `clsx(...)`, and `classnames(...)`.

## Demo app

The [`demo/`](demo/) folder is a **Vite + React + TypeScript + Tailwind** sample with a flat `src/components/` layout and [`demo/.dslint.json`](demo/.dslint.json).

```bash
cd demo && npm install && npm run dev
```

The UI comes from [`packages/dashboard`](packages/dashboard/) (**`dslinter`** on npm). Component previews are driven by **`playgrounds`** in `dslint-report.json` (from the scanner plus optional `playground_groups` in config), wired with `import.meta.glob` — you do **not** need per-file `playgroundMeta` exports.

`npm run dev` picks a mode based on whether **`cargo`** is on your `PATH`:

| Situation | Behavior |
|-----------|----------|
| Rust available | Vite and `dslint --serve` run together; the dashboard updates over **SSE** when `.tsx` files under `demo/src/` change. First run builds the binary with `cargo run --release` (~30s). |
| Rust missing | Vite only, with a warning. The app uses the committed `demo/public/dslint-report.json` and does not auto-refresh. Install Rust from [rustup.rs](https://rustup.rs) for live scanning. |

Explicit scripts: `npm run dev:serve` (SSE), `npm run dev:watch` (5s polling), `npm run dev:vite-only`.

## What the CLI covers today

- **Definitions:** functions, classes, `const` arrows, `forwardRef` / `memo`, exports
- **Usage:** PascalCase JSX and Vue template usage, with prop lists (variant hints)
- **Accessibility:** `<img>` alt, meaningful `<a href>`, `<button>` and `<input>` accessible names (JSX AST + Vue `<template>`); governance scoring weights all `a11y-*` rules
- **Smells (`smell-*`):** console/debugger noise, suppressions, TODO markers, large files, inline JSX `style`, empty `catch`, redundant fragments — lightly affects maintainability score
- **Design system:** duplicate definitions, deprecated component usage, hardcoded hex (`token-hardcoded-color`), Tailwind arbitrary values (`token-tailwind-arbitrary`)
- **Ownership:** rollups in `--json` and the dashboard when `ownership` is set
- **Scores:** heuristic governance scores (the token pillar is omitted until `known_tokens` is set); `--json` for dashboards and CI

Roadmap follows phased governance (tokens, deeper a11y, drift, AI compliance) described elsewhere in the project docs.
