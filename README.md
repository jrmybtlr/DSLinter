# DSLint

A design-system linter that scans repos for **JSX, TSX, and Vue** components, counts **how often each is used** (Storybook-style visibility without story files), and reports **design-system health** signals for the terminal, CI, or a dashboard.

**Powered by [Oxc](https://oxc.rs)** for fast JavaScript, TypeScript, and JSX parsing. Vue support uses Oxc on `<script>` blocks plus template heuristics (not the Vue compiler).

Prebuilt native binaries ship with the **`dslinter`** npm package — you do not need Rust or Cargo unless you are contributing to the scanner itself.

## Quick start

```bash
npm install -D dslinter
npx dslinter /path/to/repo
npx dslinter /path/to/repo --json
npx dslinter -p /path/to/repo
npx dslinter /path/to/repo --fail-on-warnings
npx dslinter demo --serve 4141 -o demo/public/dslint-report.json
```

The CLI binary is named **`dslinter`** (not `dslint`) to avoid collision with an unrelated [crates.io `dslint`](https://crates.io/crates/dslint) package.

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
    "disabled_rules": ["code-todo-marker"],
    "report_console_error": true
  },
  "check_dark_mode_contrast": false
}
```

`smell.disabled_rules` accepts `code-*` rule ids (and legacy `smell-*` aliases). `check_dark_mode_contrast` is **heuristic**: it inspects static `class` / `className` strings and string arguments to `cn(...)`, `clsx(...)`, and `classnames(...)` extracted from the AST where possible.

## Demo app

The [`demo/`](demo/) folder is a **Vite + React + TypeScript + Tailwind** sample with a flat `src/components/` layout and [`demo/.dslint.json`](demo/.dslint.json).

```bash
cd demo && npm install && npm run dev
```

The UI comes from [`packages/dashboard`](packages/dashboard/) (**`dslinter`** on npm). Component previews are driven by **`playgrounds`** in `dslint-report.json` (from the scanner plus optional `playground_groups` in config), wired with `import.meta.glob` — you do **not** need per-file `playgroundMeta` exports.

`npm run dev` picks a mode based on whether a **dslinter** scanner is available (NAPI binding from `npm install`, `DSLINT_BIN`, or `dslinter` on PATH):

| Situation | Behavior |
|-----------|----------|
| Scanner available | Vite and `dslinter --serve` run together; the dashboard updates over **SSE** when source files change. |
| Scanner missing | Vite only, with a warning. The app uses the committed `demo/public/dslint-report.json` and does not auto-refresh. Run `pnpm run build:napi` (contributors) or set `DSLINT_BIN`. |

Explicit scripts: `npm run dev:serve` (SSE), `npm run dev:watch` (5s polling), `npm run dev:vite-only`.

For a one-off report without the dev server:

```bash
cd demo && npm run dslint:report
```

## What the CLI covers today

- **Definitions:** functions, classes, `const` arrows, `forwardRef` / `memo`, exports
- **Usage:** PascalCase JSX and Vue template usage, with prop lists (variant hints)
- **Accessibility:** `<img>` alt, meaningful `<a href>`, `<button>` and `<input>` accessible names (JSX AST + Vue `<template>` heuristics); governance scoring weights all `a11y-*` rules
- **Code quality (`code-*`):** console/debugger noise, suppressions, TODO markers, large files, inline JSX `style`, empty `catch`, redundant fragments — lightly affects maintainability score
- **Design system:** duplicate definitions, deprecated component usage, hardcoded hex (`token-hardcoded-color`), Tailwind arbitrary values (`token-tailwind-arbitrary`)
- **Ownership:** rollups in `--json` and the dashboard when `ownership` is set
- **Scores:** heuristic governance scores (the token pillar is omitted until `known_tokens` is set); `--json` for dashboards and CI

Roadmap follows phased governance (tokens, deeper a11y, drift, AI compliance) described elsewhere in the project docs.

## Contributing (Rust scanner)

From the repository root:

```bash
cargo build --release
cargo test
./target/release/dslinter demo --json
cargo run --release --bin dslinter -- demo -p --json
```

NAPI bindings for npm are built and published by [`.github/workflows/release-napi-bindings.yml`](.github/workflows/release-napi-bindings.yml). Maintainers publish with `pnpm run release:patch` (see [`packages/dashboard/README.md`](packages/dashboard/README.md)).

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for distribution notes and development workflow.
