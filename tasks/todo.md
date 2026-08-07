# DSLinter — active checklist

See [ROADMAP.md](../ROADMAP.md) for phased product goals.

## Address Copilot review on PR #42

- [x] Fix ComponentPlaygroundPane useEffect deps (`entry.controls` reset)
- [x] Tighten `score_deltas` to `Partial<Record<keyof scores, number>>`
- [x] Harden `balanced_object_body` (+ `top_level_ident_keys`) to skip strings/comments
- [x] Relativize absolute paths in committed demo/dashboard reports
- [x] Verify with tests

### Review

- Restored Copilot’s playground/`score_deltas` fixes that local WIP had undone.
- `report_console_error` serde/`Default` mismatch was already fixed (`default_true`).
- Vue regex fallback now skips comments/strings when brace-balancing and key-scanning; covered by unit tests.
- Committed `dslinter-report.json` files use `root: "."` and scan-root-relative paths (incl. `../…` for out-of-root CSS), so no machine-specific `/Users/…` paths remain.
