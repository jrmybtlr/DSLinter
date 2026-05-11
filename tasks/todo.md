# DSLint MVP — plan

## Done

- [x] Rust crate `dslint` with Oxc-powered JSX/TSX parsing and Vue SFC script + template pass
- [x] Workspace scan (parallel option), JSON + human reports
- [x] Rules: duplicates, deprecation config, token adoption stub, hex colors, img alt, variant explosion hint
- [x] Governance score placeholders derived from findings

## Review

- `cargo test` passes; CLI smoke-tested on empty tree
- Workbench: playgrounds from `dslint-report.json` (`playgrounds`) + glob; `definePlayground()` optional escape hatch; `npm run build` in `demo/` passes
- Unified demo `src/components/` layout: run `npm run dslint:report` (needs `cargo`) for a full rescan; `merge-playgrounds.mjs` patches legacy paths and infers empty `declared_props` from TSX when needed

- `ignore` crate omitted (pinned `globset` incompatible with Cargo 1.83); walker skips common vendor dirs
