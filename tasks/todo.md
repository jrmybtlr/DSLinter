# DSLinter — active checklist

See [ROADMAP.md](../ROADMAP.md) for phased product goals.

## Remove Implementation classes

- [x] Remove UI sections + `ComponentImplementationClasses`
- [x] Remove dashboard types/helpers/tests
- [x] Remove Rust model fields, `class_usage` module, attach call
- [x] Clean struct literals + update `demo_inertia` test
- [x] Verify cargo / dashboard tests

## Parked — Vue defineProps AST extraction

- [ ] Replace fragile regex `defineProps({…})` matcher with Oxc AST extraction
- [ ] Support nested runtime validators (`type`/`default`/`PropType`)
- [ ] Support `defineProps<Props>()`, inline `defineProps<{…}>()`, and `withDefaults(defineProps<…>(), {…})`
- [ ] Resolve `interface` / `type` Props via existing `ts_shape_map`
- [ ] Populate `declared_prop_defaults` from `withDefaults` string literals
- [ ] Populate `declared_prop_options` from finite string unions on TS prop types
- [ ] Keep Options API regex as fallback when no `defineProps` found
- [ ] Tests: nested runtime, TS generic+interface, withDefaults, inline type literal
- [ ] `cargo test` passes

## Review

- Removed Implementation classes from inspect/playground panes and deleted `ComponentImplementationClasses`.
- Dropped report fields (`implementation_class_frequencies` / `_locations`), `class_usage` rollup, and related tests.
- `cargo test` and dashboard `aggregate.test.ts` pass.
