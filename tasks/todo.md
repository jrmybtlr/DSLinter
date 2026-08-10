# Fix NAPI release CI (v0.8.0)

## Checklist

- [x] Diagnose failed `Release NAPI bindings` run (31343209989)
- [x] Fix build job install so `--use-napi-cross` can load toolchain bindings
- [x] Commit + re-run release workflow for `v0.8.0` (or retag)
- [x] Fix mold rustflags breaking napi-cross gcc (`-fuse-ld=mold`)
- [ ] Retag `v0.8.0` and confirm publish succeeds

## Review

1. `--no-optional` skipped `@napi-rs/cross-toolchain-*` → fixed by installing optional deps.
2. Follow-up: `.cargo/config.toml` injects `-fuse-ld=mold`; napi-cross gcc rejects it.
   Clear `CARGO_TARGET_*_LINUX_*_RUSTFLAGS` on the release build step.
