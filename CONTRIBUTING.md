# Contributing to DSLint

## Rust scanner

Requirements: Rust stable (see CI), Cargo.

```bash
cargo build --release
cargo test
./target/release/dslinter /path/to/repo --json
```

The library API lives in [`src/lib.rs`](src/lib.rs) (`scan_file`, `scan_workspace`, `scan_workspace_parallel`). The CLI binary is **`dslinter`** (`cargo build --release --bin dslinter`).

Do **not** publish or document `cargo install dslint` — that name on crates.io is an unrelated project.

## npm package (`dslinter`)

The dashboard + CLI wrapper is [`packages/dashboard`](packages/dashboard/). Published as **`dslinter`** on npm.

### Current distribution: postinstall download

On `npm install dslinter`, [`packages/dashboard/scripts/ensure-dslint.mjs`](packages/dashboard/scripts/ensure-dslint.mjs) downloads a platform binary from GitHub Releases (`v` + package version) into `node_modules/dslinter/vendor/`.

Supported release triples (see [`resolve-dslint-binary.mjs`](packages/dashboard/scripts/resolve-dslint-binary.mjs)):

- `dslinter-x86_64-unknown-linux-gnu`
- `dslinter-aarch64-unknown-linux-gnu`
- `dslinter-x86_64-apple-darwin`
- `dslinter-aarch64-apple-darwin`
- `dslinter-x86_64-pc-windows-msvc.exe`

CI builds these in [`.github/workflows/release-dslint-binaries.yml`](.github/workflows/release-dslint-binaries.yml).

Emergency single-platform upload:

```bash
node scripts/upload-release-binary.mjs v0.0.16
```

### Future distribution: optionalDependencies platform packages

We may later adopt an **oxlint-style** model: separate npm packages per OS/arch (`@dslinter/darwin-arm64`, etc.) wired through `optionalDependencies`, with small native addons loaded by Node.

| Approach | Pros | Cons |
|----------|------|------|
| Postinstall download (today) | One npm package; simple release tagging | Needs GitHub Releases API; private repos need `GITHUB_TOKEN` |
| optionalDependencies (future) | Works offline from npm registry mirrors; no release API at install | Many packages per release; more publish automation |

No decision to migrate yet — evaluate when enterprise/offline installs become a top request.

## Release workflow

From repo root (maintainers):

```bash
pnpm run release:patch   # test → version bump → git push + tag vX.Y.Z → wait for CI → npm publish
```

npm `dslinter@X.Y.Z` must match GitHub tag `vX.Y.Z` with attached `dslinter-*` assets.
