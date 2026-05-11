# `@dslint/workbench`

React workbench for DSLint: hash-routed sidebar, optional component previews, token wall, and governance views driven by `dslint-report.json`.

**Peer deps:** `react`, `react-dom` ^18.

**Consumer setup:** call `useWorkspaceReport()` once, pass `dslintReport` into `<WorkbenchLayout />` (shared by Governance + per-file a11y scores). Build `playgroundEntries` by joining `dslintReport.report.playgrounds` to your component modules (see `demo/src/playground/buildRegistry.ts`) and pass `tokenCatalog`. Each entry may include `controls` and optional `usageSnippet(values)`; previews receive `values`. Optional `definePlayground()` exists for manual overrides. See the `demo/` app in this repository.
