---
name: dslinter
description: >-
  Use DSLinter MCP tools when building or reviewing UI in this repo. Call
  dslinter_get_agent_context before generating components; dslinter_get_component
  for unfamiliar APIs; dslinter_get_findings or dslinter_check_paths after edits.
disable-model-invocation: true
---

# DSLinter agent skill

Use the **dslinter** MCP server (`npx dslinter mcp`) for design-system governance in this repository.

## Before writing UI

1. Call **`dslinter_get_agent_context`** — scores, top components by usage, deprecated names, dos/donts.
2. Call **`dslinter_get_catalog`** with a `query` when looking for an existing component.
3. Call **`dslinter_get_component`** for props, CVA variants, and **`example_jsx`** from real call sites.

## After editing UI files

1. Call **`dslinter_check_paths`** with the files you changed (`fresh: true` if needed).
2. Treat **`error`** severity findings as blockers; **`warning`** as should-fix.
3. Use **`dslinter_suggest_fix`** for deprecated components, hardcoded colors, and a11y rules.

## Drift and policy

- **`dslinter_get_policy`** — deprecated components, known tokens, include_dirs, rule catalog.
- **`dslinter_diff_since`** — compare to baseline; pass `save_baseline: true` to update `.dslinter/mcp-baseline.json`.

## Rules

- Do **not** invent new components when the catalog already has a match.
- Do **not** use components listed in **`deprecated_components`**.
- Match **prop value frequencies** from usage data (e.g. `variant`, `size`).
- Prefer theme **tokens** over hardcoded hex or Tailwind arbitrary values (`bg-[#...]`).

## Resources

- `dslinter://context` — agent context markdown
- `dslinter://catalog` — component catalog JSON
- `dslinter://component/{name}` — single component spec
