# DSLinter

A design-system linter that scans repos for **JSX, TSX, and Vue** components, counts **how often each is used** (Storybook-style visibility without story files), and reports **design-system health** signals for the terminal, CI, or a dashboard.

**Powered by [Oxc](https://oxc.rs)** for fast JavaScript, TypeScript, and JSX parsing. Vue support uses Oxc on `<script>` blocks plus template heuristics (not the Vue compiler).

Prebuilt native binaries ship with the **`dslinter`** npm package — you do not need Rust or Cargo unless you are contributing to the scanner itself.

## Quick start

```bash
npm install -D dslinter
npx dslinter                    # local dev: watch + dashboard (Vite app required)
npx dslinter init               # scaffold baseline .dslinter.json + optional playground registry files
npx dslinter --report /path/to/repo
npx dslinter --report /path/to/repo --json
npx dslinter --report -p /path/to/repo --fail-on-warnings
npx dslinter --report --output public/dslinter-report.json
npx dslinter --watch --output public/dslinter-report.json
npx dslinter --build            # write report + vite build (in a Vite project)
```

In **CI** (`CI=true`), bare `npx dslinter` runs **`--report`** (one-shot stdout). Use `--report` explicitly if your CI does not set `CI`.
On local first run, `npx dslinter` auto-creates a starter **`.dslinter.json`** when no config exists.

The CLI binary is named **`dslinter`** (not `dslint`) to avoid collision with an unrelated [crates.io `dslint`](https://crates.io/crates/dslint) package.

## What gets scanned

- **Respects ignores:** `.gitignore` and `.dslinterignore` at the repo root (globset semantics; **last matching rule wins**, including `!` negation; use `\!` for a literal `!`). Optional `exclude_globs` in config apply too.
- **Inline suppressions:** On the line above a finding, use `// dslinter-ignore-next-line rule-id` (comma-separated rules; `*` or `prefix*` allowed). That line only suppresses the **next** source line.
- **Overlap:** If **`token-hardcoded-color`** and **`token-tailwind-arbitrary`** both hit the same line, only the Tailwind rule is reported.

## Config (optional)

Put `.dslinter.json` at the repository root:

```json
{
  "include_dirs": ["src/components"],
  "ignore_globs": ["fixtures/**"],
  "css_entrypoints": ["src/index.css"],
  "deprecated_components": ["LegacyButton"],
  "known_tokens": ["--color-", "spacing.", "theme."],
  "exclude_globs": ["fixtures/**", "*.generated.tsx"],
  "smell": {
    "disabled_rules": ["code-todo-marker"],
    "report_console_error": true
  },
  "check_unused_props": false,
  "check_dark_mode_contrast": false,
  "check_unused_css_tokens": false,
  "local_import_prefixes": ["@/", "~/"],
  "external_import_patterns": ["@radix-ui/*", "lucide-react"]
}
```

`include_dirs` restricts component discovery to those directory prefixes.  
`ignore_globs` uses the same ignore semantics as `.gitignore`/`.dslinterignore`.  
`css_entrypoints` scopes token analysis to selected CSS entry files (+ their `@import` graph).
`check_unused_props` enables `unused-prop` findings for declared props that have no call-site usage.
`local_import_prefixes` marks import path prefixes as local (in-repo) modules.
`external_import_patterns` excludes matching third-party modules from the component catalog.

`smell.disabled_rules` accepts `code-*` rule ids (and legacy `smell-*` aliases). `check_dark_mode_contrast` is **heuristic**: it inspects static `class` / `className` strings and string arguments to `cn(...)`, `clsx(...)`, and `classnames(...)` extracted from the AST where possible.
Legacy `exclude_globs` remains supported for backwards compatibility.

## Demos

- [`demo/react`](demo/react/) — Vite + React + TypeScript + Tailwind sandbox with the dashboard UI. See [`demo/react/README.md`](demo/react/README.md).
- [`demo/inertia`](demo/inertia/) — Laravel 13 + Inertia + React + shadcn/ui. See [`demo/inertia/README.md`](demo/inertia/README.md).

## What the CLI covers today

- **Definitions:** functions, classes, `const` arrows, `forwardRef` / `memo`, exports
- **Usage:** PascalCase JSX and Vue template usage, with prop lists (variant hints)
- **Accessibility:** `<img>` alt, meaningful `<a href>`, `<button>` and `<input>` accessible names (JSX AST + Vue `<template>` heuristics); governance scoring weights all `a11y-*` rules
- **Code quality (`code-*`):** console/debugger noise, suppressions, TODO markers, large files, inline JSX `style`, empty `catch`, redundant fragments — lightly affects maintainability score
- **Design system:** duplicate definitions, deprecated component usage, hardcoded hex (`token-hardcoded-color`), Tailwind arbitrary values (`token-tailwind-arbitrary`), CSS custom-property inventory with used/unused tracking (`css_tokens` in `--json`)
- **Scores:** heuristic governance scores (token pillar uses CSS token adoption when `css_tokens` is present, else `known_tokens` substring match); `--json` for dashboards and CI
- **CSS tokens (`css_tokens` in JSON):** scans source `.css` (plus `@import` targets like `dslinter/theme.css`), classifies `--color-*` / `--spacing-*` / etc., and reports references from `var(--*)` and Tailwind utilities; optional `token-unused-css-var` when `check_unused_css_tokens` is true

Roadmap follows phased governance (tokens, deeper a11y, drift, AI compliance) described elsewhere in the project docs.

## MCP for AI agents

DSLinter ships a **Model Context Protocol** server so Cursor, Claude Code, and other agents can query the component catalog, usage patterns, findings, and governance policy without parsing the full report JSON.

### Setup (Cursor)

Add to `.cursor/mcp.json` in your app root:

```json
{
  "mcpServers": {
    "dslinter": {
      "command": "npx",
      "args": ["dslinter", "mcp"],
      "cwd": "${workspaceFolder}"
    }
  }
}
```

For monorepos, set `cwd` to the app directory (e.g. `demo/react/` or `demo/inertia/`) or set `DSLINTER_SCAN_ROOT`.

### Tools

| Tool                          | Purpose                                            |
| ----------------------------- | -------------------------------------------------- |
| `dslinter_scan`               | Refresh report; return scores and finding counts   |
| `dslinter_get_catalog`        | Components sorted by usage                         |
| `dslinter_get_component`      | Props, variants, findings, example JSX             |
| `dslinter_get_findings`       | Filter findings by component, rule, severity, path |
| `dslinter_get_usage_examples` | Call sites and prop value frequencies              |
| `dslinter_get_tokens`         | CSS token definitions and unused tokens            |
| `dslinter_get_agent_context`  | Compact context pack for system prompts            |
| `dslinter_get_policy`         | Config snapshot + rule catalog                     |
| `dslinter_check_paths`        | Findings for specific files after edits            |
| `dslinter_diff_since`         | Drift vs saved baseline                            |
| `dslinter_suggest_fix`        | Heuristic fix suggestions                          |

### Environment

| Variable               | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `DSLINTER_SCAN_ROOT`   | Scan boundary override                           |
| `DSLINTER_REPORT_PATH` | Report file override                             |
| `DSLINTER_MCP_DEV_URL` | Dev server URL (default `http://127.0.0.1:7878`) |
| `DSLINTER_MCP_TTL_MS`  | Report cache TTL (default 60000)                 |

When `npx dslinter` dev mode is running, the MCP server prefers the live report from port 7878.

### Self-test

```bash
cd demo/react && npx dslinter mcp --self-test
```

See [`.cursor/skills/dslinter/SKILL.md`](.cursor/skills/dslinter/SKILL.md) for agent workflow guidance.

## Contributing (Rust scanner)

From the repository root:

```bash
cargo build --release
cargo test
./target/release/dslinter demo/react --json
cargo run --release --bin dslinter -- demo/react -p --json
```

NAPI bindings for npm are built and published by [`.github/workflows/release-napi-bindings.yml`](.github/workflows/release-napi-bindings.yml). Maintainers publish with `pnpm run release:patch` (see [`packages/dashboard/README.md`](packages/dashboard/README.md)).

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for distribution notes and development workflow.
