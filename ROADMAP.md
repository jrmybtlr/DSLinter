# DSLinter roadmap

Public path from alpha toward beta. Detailed private planning may live elsewhere; this file tracks shipped intent consumers can rely on.

## Beta goals

- Stable report schema with documented breaking changes per minor release
- Reliable JSX / Vue component inventory and playground controls
- Accessibility rules with consistent severity across JSX and Vue
- Token adoption + unused CSS variable reporting
- Baseline drift CLI / MCP for CI regressions
- Dashboard embeds (Vite plugin + UseClassy) documented for consumers

## Recently landed (0.7.x)

- Removed `implementation_class_*` report fields
- Vue `defineProps` AST extraction (incl. `PropType<'a' | 'b'>` options)
- Baseline drift (`--update-baseline` / `--diff-baseline` / `--fail-on-drift`)
- Optional `token_adoption` score; `check_unused_css_tokens` defaults to true
- Dashboard UseClassy migration for source embeds

## Next

- Deeper a11y (label/`htmlFor` pairing, richer Vue template analysis)
- Stronger AI / MCP compliance loops
- Broader control inference parity (React `PropType`-style unions, compound playgrounds)
