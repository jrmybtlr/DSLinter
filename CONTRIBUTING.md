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

### Distribution: NAPI bindings (oxlint-style)

`npm install dslinter` installs the matching **`@dslinter/binding-*`** optional dependency for your platform (linux/mac/windows, x64/arm64). The `dslinter` CLI loads a **napi-rs** native addon and runs the Rust CLI in-process (`runCli`).

Platform packages (published from CI):

- `@dslinter/binding-darwin-arm64`
- `@dslinter/binding-darwin-x64`
- `@dslinter/binding-linux-arm64-gnu`
- `@dslinter/binding-linux-x64-gnu`
- `@dslinter/binding-win32-x64-msvc`

Local development (current platform only):

```bash
pnpm run build:napi
node packages/dashboard/bin/dslinter.mjs --version
```

Override with a cargo-built binary: `DSLINT_BIN=/path/to/target/release/dslinter`.

## Release workflow

From repo root (maintainers). Requires `NPM_TOKEN` in GitHub Actions secrets with **publish** access to the entire **`@dslinter` scope** (every `@dslinter/binding-*` platform package plus `dslinter`). A granular token limited to `dslinter` only will fail with `404 Not Found` on binding publishes.

Create the token at [npmjs.com/settings/tokens](https://www.npmjs.com/settings/tokens): use an **Automation** token, or a **Granular** token with *Packages and scopes* → *Read and write* for `@dslinter/*` (or all packages on the account).

```bash
# After creating the token on npmjs.com:
gh secret set NPM_TOKEN --repo jrmybtlr/DSLinter

pnpm run release:patch   # test → version bump → git push + tag vX.Y.Z → CI publishes npm
```

If publish fails with `401` on `npm whoami` or `404` on `@dslinter/binding-*`, the `NPM_TOKEN` secret is expired or revoked — regenerate the token and update the secret, then re-run the workflow (no new tag needed if that version was never published):

```bash
gh workflow run release-napi-bindings.yml --ref v0.1.10
```

CI workflow: [`.github/workflows/release-napi-bindings.yml`](.github/workflows/release-napi-bindings.yml) builds all platform bindings and publishes `@dslinter/binding-*` plus `dslinter`.
