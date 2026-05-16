# DSLint

Rust CLI that inventories **JSX / TSX / Vue** components in a local repository, rolls up **usage frequency** (Storybook-style visibility without story files), and emits **governance signals** for design-system quality.

## Usage

```bash
cargo build --release
./target/release/dslint /path/to/repo               # human summary
./target/release/dslint /path/to/repo --json       # machine-readable report
./target/release/dslint -p /path/to/repo           # parallel scan (large trees)
./target/release/dslint /path/to/repo --fail-on-warnings
./target/release/dslint /path/to/repo --max-warnings 10
```

Scans honor `.gitignore` and `.dslintignore` at the repo root (glob semantics via `globset`, **last matching rule wins**, including `!` negation and `\!` to match a literal leading `!`), plus `exclude_globs` from config. On the line above a violation, `// dslint-ignore-next-line rule-id` (comma-separated; `*` or `prefix*`) suppresses matching findings on the next line.

Overlapping **`token-hardcoded-color`** and **`token-tailwind-arbitrary`** on the same source line are collapsed to the Tailwind rule only.

Optional config (repository root): `.dslint.json` or `dslint.json`:

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
  }
}
```

## Demo

See [`demo/`](demo/) for a **Vite + React + TypeScript + Tailwind** app with a flat `src/components/` showcase plus `demo/.dslint.json`. The demo UI is a **dashboard** from the [`packages/dashboard`](packages/dashboard/) npm package (`@dslinter/dashboard`): component previews are listed from **`playgrounds`** in `dslint-report.json` (built by the Rust scanner from source + `playground_groups` in config), joined to modules via `import.meta.glob` — no per-file `playgroundMeta` exports required.

```bash
cd demo && npm install && npm run dev
```

`npm run dev` auto-detects whether `cargo` is on `PATH`:

- **Rust installed** — runs Vite **and** `dslint --serve` together, so the dashboard refreshes over SSE whenever a `.tsx` under `demo/src/` changes (no manual report regeneration). The dslint binary is built on first run with `cargo run --release` (~30s).
- **Rust missing** — falls back to Vite alone with a warning. The dashboard reads the committed `demo/public/dslint-report.json` and won't auto-update. Install Rust at <https://rustup.rs> to enable live updates.

Force a flavor explicitly with `npm run dev:serve` (SSE), `npm run dev:watch` (5s polling), or `npm run dev:vite-only`.

## MVP scope

- Component definitions (functions, classes, `const` arrows, `forwardRef` / `memo`, exports)
- PascalCase JSX / Vue template usage with prop lists (variant-surface hint)
- Accessibility: `<img>` alt, meaningful `<a href>`, `<button>` accessible names, `<input>` accessible names (JSX AST + Vue `<template>`); governance score weights all `a11y-*` rules
- Code quality heuristics (`smell-*` rule ids): console/debugger noise, suppressions, TODO markers, oversized files, inline JSX `style`, empty `catch`, redundant fragments; lightly lowers maintainability score
- Duplicate definition detection, deprecation usage, hardcoded hex colors, Tailwind arbitrary bracket values (`token-tailwind-arbitrary`)
- Ownership rollup in `--json` / dashboard when `ownership` paths are configured
- Heuristic governance scores (design-system health omits token pillar until `known_tokens` is set) and `--json` output for dashboards / CI

Roadmap aligns with phased governance (tokens, a11y depth, drift, AI compliance) described in project docs.
