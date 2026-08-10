# Fix NAPI release CI (v0.8.0)

## Checklist

- [x] Diagnose failed `Release NAPI bindings` run (31343209989)
- [x] Fix build job install so `--use-napi-cross` can load toolchain bindings
- [ ] Commit + re-run release workflow for `v0.8.0` (or retag)

## Review

Linux build jobs failed with:

`Failed to set up the --use-napi-cross toolchain … Cannot find native binding`

Cause: build matrix used `pnpm install --no-optional`, which skips `@napi-rs/cross-toolchain-*` (and `@napi-rs/lzma` / `@napi-rs/tar` platform packages). Publish job already installs optional deps; build did not.

Fix: drop `--no-optional` on the build job; keep `--ignore-scripts`.
