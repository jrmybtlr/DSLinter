# DSLint MVP — plan

## Done

- [x] Rust crate `dslint` with Oxc-powered JSX/TSX parsing and Vue SFC script + template pass
- [x] Workspace scan (parallel option), JSON + human reports
- [x] Rules: duplicates, deprecation config, token adoption stub, hex colors, img alt, variant explosion hint
- [x] Governance score placeholders derived from findings

## Review

- `cargo test` passes; CLI smoke-tested on empty tree
- dashboard: playgrounds from `dslint-report.json` (`playgrounds`) + glob; `definePlayground()` optional escape hatch; `npm run build` in `demo/` passes
- Unified demo `src/components/` layout: run `npm run dslint:report` (needs `cargo`) for a full rescan; `merge-playgrounds.mjs` patches legacy paths and infers empty `declared_props` from TSX when needed

- `ignore` crate omitted (pinned `globset` incompatible with Cargo 1.83); walker skips common vendor dirs

## In progress — Component usage explorer

- [x] Extend scan output to record **literal prop values** at JSX call sites (e.g. `size="sm"`, `disabled`, `rows={3}`)
- [x] Roll up per-component **prop value frequencies** into `usage_by_component`
- [x] Update dashboard `WorkspaceReport` TypeScript types to mirror new JSON fields
- [x] Update dashboard `ComponentCatalog` expanded row: **call-site table** plus prop frequency / literal breakdown (no separate Usage/Props tabs)
- [x] Playground **Repo usage**: table of call sites; **API reference** gains repo call-site + literal columns (and “repo-only” props) when a report is loaded
- [ ] Dev UX: allow prebuilt `dslint` binary for demo live mode
  - [x] Add `demo/scripts/run-dslint.mjs` wrapper (prefers `dslint`, falls back to `cargo run`)
  - [x] Update `demo/package.json` `dslint:*` scripts to use wrapper + add `dslint:print-cmd`
  - [x] Update `demo/scripts/dev.mjs` to enable live mode when either `dslint` or `cargo` exists
  - [ ] Verification: `npm run dslint:print-cmd` and `npm run build` in `demo/`
- [ ] Debug: LegacyButton prop/controls not updating in dashboard
  - [ ] Trace how `dslint-report.json` builds `playgrounds[].controls` and `declared_props`
  - [ ] Confirm whether the dashboard is serving a stale `dslint-report.json` (or not regenerating it)
  - [ ] Make minimal fix so updated prop options appear for `LegacyButton`
  - [ ] Verify in running dashboard page that controls/options match updated unions
- [ ] Verification
  - [ ] Run `cargo test`
  - [ ] Run `npm run build` in `demo/` to confirm TypeScript + UI compile
  - [ ] Run the report generator and confirm `dslint-report.json` changes as expected

## Review (to fill)

- [ ] Notes, screenshots, or caveats

## Done — shadcn/ui contained in `dslinter`

- [x] **`packages/dashboard/src/styles/dashboard-theme.css`** — `@import "tw-animate-css"` + `shadcn/tailwind.css`, shadcn `@theme inline` / `:root` / `.dark` / `@layer base`, plus DSLinter layout tokens (`--color-surface`, `rounded-ds-*`, progress keyframes). Exported as **`dslinter/theme.css`** (`package.json` `exports`).
- [x] **`demo/src/index.css`** — only Tailwind + `@source` + `@import "dslinter/theme.css"` (no duplicate token maintenance in the demo).
- [x] **`packages/dashboard/src/components/ui/`** — `button`, `input`, `label`, `select`, `checkbox` (new-york style, `../../lib/utils` imports so consumers need no path aliases).
- [x] **`packages/dashboard/src/lib/utils.ts`** — `cn()` helper; **`packages/dashboard/components.json`** for future `shadcn add`.
- [x] **Root `package.json` workspaces** — `["demo", "packages/dashboard"]` so all dashboard `dependencies` (Radix, shiki, shadcn stack, etc.) hoist to one `node_modules` and `demo`’s `tsc` resolves imports into the dashboard package.
- [x] **`PlaygroundControls`** — uses shadcn `Button`, `Input`, `Label`, `Checkbox`, `Select`.
- [x] **Shiki** — declared on dashboard `package.json` (was missing; surfaced once workspace typecheck included all dashboard files).

**Consumers:** after `npm install dslinter`, add to app CSS (after `@import "tailwindcss"` and `@source` for `…/node_modules/dslinter/src` or your linked path): `@import "dslinter/theme.css";`

**Optional next:** dashboard `FindingsList` / `ComponentCatalog` tabs + `dropdown-menu`.

## Review (shadcn)

- **npm:** `npm install` from repo root or `demo/` (npm finds parent `workspaces`). Use `"dslinter": "file:../packages/dashboard"` in `demo` — not `"*"` (registry 404).
- **pnpm:** repo root has `pnpm-workspace.yaml`; run **`pnpm install` from the repo root** so `demo` is in the workspace and the `file:` link resolves. Same `file:` dependency as npm.

## Done — Shiki + Twoslash (`PlaygroundA11yAndCode` usage panel)

**Shipped:** [Shiki](https://shiki.style/) fine-grained bundle (`createHighlighterCore` + `@shikijs/langs/tsx` + `@shikijs/themes/github-dark` + JS regex engine) and [Twoslash via CDN](https://shiki.style/packages/twoslash) (`twoslash-cdn` + `createTransformerFactory` + `rendererRich`, `throws: false`). Twoslash runs only when `usageSnippetNeedsTwoslash()` matches (`^?`, `// @errors` / `@log` / etc., `// ---cut---`). Twoslash + TypeScript live in **`playgroundUsageTwoslash.ts`** loaded with `import()` so the main chunk stays ~579 kB gzipped ~139 kB; the Twoslash chunk is ~3.6 MB and loads on first Twoslash snippet. **IndexedDB / unstorage** cache was omitted to keep integration small (optional follow-up).

**Files:** `PlaygroundUsageCode.tsx`, `playgroundUsageHighlight.ts`, `playgroundUsageTwoslash.ts`, `PlaygroundA11yAndCode.tsx`; `@shikijs/twoslash/style-rich.css`; dashboard package `sideEffects: ["**/*.css"]`.

**Verify:** `npm run build` in `demo/` passes.

## Review (Shiki + Twoslash)

- Main vs Twoslash async chunk sizes as above; no `optimizeDeps` change required for current Vite build.
