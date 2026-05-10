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

See [`demo/`](demo/) for a **Vite + React + TypeScript + Tailwind** app with ten “good” and ten “bad” components plus `demo/.dslint.json`. The demo UI is a **workbench** from the [`packages/workbench`](packages/workbench/) npm package (`@dslint/workbench`): optional `playgroundMeta` / `PlaygroundPreview` exports on component modules plus `demo/public/dslint-report.json`.

```bash
cd demo && npm install && npm run dev
cargo run --release -- demo -p
cd demo && npm run dslint:report   # regenerate dashboard JSON
```

## MVP scope

- Component definitions (functions, classes, `const` arrows, `forwardRef` / `memo`, exports)
- PascalCase JSX / Vue template usage with prop lists (variant-surface hint)
- Accessibility: `<img>` alt, meaningful `<a href>`, `<button>` accessible names, `<input>` accessible names (JSX AST + Vue `<template>`); governance score weights all `a11y-*` rules
- Code smells (`smell-*`): console/debugger noise, suppressions, TODO markers, oversized files, inline JSX `style`, empty `catch`, redundant fragments; lightly lowers maintainability score
- Duplicate definition detection, deprecation usage, hardcoded hex colors, Tailwind arbitrary bracket values (`token-tailwind-arbitrary`)
- Ownership rollup in `--json` / dashboard when `ownership` paths are configured
- Heuristic governance scores (design-system health omits token pillar until `known_tokens` is set) and `--json` output for dashboards / CI

Roadmap aligns with phased governance (tokens, a11y depth, drift, AI compliance) described in project docs.
