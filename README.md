# DSLint

A design-system linter that scans repos for **JSX, TSX, and Vue** components, counts **how often each is used** (Storybook-style visibility without story files), and reports **design-system health** signals for the terminal, CI, or a dashboard.

**Powered by [Oxc](https://oxc.rs)** for fast JavaScript, TypeScript, and JSX parsing. Vue support uses Oxc on `<script>` blocks plus template heuristics (not the Vue compiler).

Prebuilt native binaries ship with the **`dslinter`** npm package — you do not need Rust or Cargo unless you are contributing to the scanner itself.

## Quick start

```bash
npm install -D dslinter
npx dslinter                    # local dev: watch + dashboard (Vite app required)
npx dslinter init               # scaffold baseline .dslint.json + optional playground registry files
npx dslinter --report /path/to/repo
npx dslinter --report /path/to/repo --json
npx dslinter --report -p /path/to/repo --fail-on-warnings
npx dslinter --report --output public/dslint-report.json
npx dslinter --watch --output public/dslint-report.json
npx dslinter --build            # write report + vite build (in a Vite project)
```

In **CI** (`CI=true`), bare `npx dslinter` runs **`--report`** (one-shot stdout). Use `--report` explicitly if your CI does not set `CI`.
On local first run, `npx dslinter` auto-creates a starter **`.dslint.json`** when no config exists.

The CLI binary is named **`dslinter`** (not `dslint`) to avoid collision with an unrelated [crates.io `dslint`](https://crates.io/crates/dslint) package.

## What gets scanned

- **Respects ignores:** `.gitignore` and `.dslintignore` at the repo root (globset semantics; **last matching rule wins**, including `!` negation; use `\!` for a literal `!`). Optional `exclude_globs` in config apply too.
- **Inline suppressions:** On the line above a finding, use `// dslint-ignore-next-line rule-id` (comma-separated rules; `*` or `prefix*` allowed). That line only suppresses the **next** source line.
- **Overlap:** If **`token-hardcoded-color`** and **`token-tailwind-arbitrary`** both hit the same line, only the Tailwind rule is reported.

## Config (optional)

Put `.dslint.json` or `dslint.json` at the repository root:

```json
{
  "include_dirs": ["src/components"],
  "ignore_globs": ["fixtures/**"],
  "css_entrypoints": ["src/index.css"],
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
  "check_dark_mode_contrast": false,
  "check_unused_css_tokens": false
}
```

`include_dirs` restricts component discovery to those directory prefixes.  
`ignore_globs` uses the same ignore semantics as `.gitignore`/`.dslintignore`.  
`css_entrypoints` scopes token analysis to selected CSS entry files (+ their `@import` graph).

`smell.disabled_rules` accepts `code-*` rule ids (and legacy `smell-*` aliases). `check_dark_mode_contrast` is **heuristic**: it inspects static `class` / `className` strings and string arguments to `cn(...)`, `clsx(...)`, and `classnames(...)` extracted from the AST where possible.
Legacy `exclude_globs` remains supported for backwards compatibility.

## Demo app

The [`demo/`](demo/) folder is a **Vite + React + TypeScript + Tailwind** sample with a flat `src/components/` layout and [`demo/.dslint.json`](demo/.dslint.json).

```bash
cd demo && npm install && npm run dev
```

The UI comes from [`packages/dashboard`](packages/dashboard/) (**`dslinter`** on npm). Component previews are driven by **`playgrounds`** in `dslint-report.json` (from the scanner plus optional `playground_groups` in config), wired with `import.meta.glob` — you do **not** need per-file `playgroundMeta` exports.

`npm run dev` runs **`dslinter`** (same as `npx dslinter` in `demo/`): scanner on port **7878** plus Vite with proxy to `/dslint-report.json` and `/events` (SSE live updates). Requires the NAPI binding from `npm install` or `DSLINT_BIN`.

| Script | Behavior |
|--------|----------|
| `npm run dev` | `dslinter` dev mode (watch + serve + Vite) |
| `npm run dev:serve` | Scanner HTTP only (`--serve 7878`) |
| `npm run dev:watch` | Watch JSON file only (no Vite) |
| `npm run dev:vite-only` | Vite only (static committed report) |
| `npm run dslint:report` | One-shot report file + merge playgrounds |

For CI or a terminal-only report:

```bash
npx dslinter --report /path/to/repo --json --fail-on-warnings
```

## What the CLI covers today

- **Definitions:** functions, classes, `const` arrows, `forwardRef` / `memo`, exports
- **Usage:** PascalCase JSX and Vue template usage, with prop lists (variant hints)
- **Accessibility:** `<img>` alt, meaningful `<a href>`, `<button>` and `<input>` accessible names (JSX AST + Vue `<template>` heuristics); governance scoring weights all `a11y-*` rules
- **Code quality (`code-*`):** console/debugger noise, suppressions, TODO markers, large files, inline JSX `style`, empty `catch`, redundant fragments — lightly affects maintainability score
- **Design system:** duplicate definitions, deprecated component usage, hardcoded hex (`token-hardcoded-color`), Tailwind arbitrary values (`token-tailwind-arbitrary`), CSS custom-property inventory with used/unused tracking (`css_tokens` in `--json`)
- **Ownership:** rollups in `--json` and the dashboard when `ownership` is set
- **Scores:** heuristic governance scores (token pillar uses CSS token adoption when `css_tokens` is present, else `known_tokens` substring match); `--json` for dashboards and CI
- **CSS tokens (`css_tokens` in JSON):** scans source `.css` (plus `@import` targets like `dslinter/theme.css`), classifies `--color-*` / `--spacing-*` / etc., and reports references from `var(--*)` and Tailwind utilities; optional `token-unused-css-var` when `check_unused_css_tokens` is true

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
