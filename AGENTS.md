# DSLint

A Rust-based linting tool (binary application).

## Cursor Cloud specific instructions

### Toolchain

- Rust stable toolchain is pre-installed via `rustup` (rustc, cargo, clippy, rustfmt).
- No additional system dependencies are required.

### Common commands

| Task | Command |
|---|---|
| Build (dev) | `cargo build` |
| Run | `cargo run` |
| Test | `cargo test` |
| Lint | `cargo clippy` |
| Format check | `cargo fmt --check` |
| Format fix | `cargo fmt` |

### Notes

- The project uses Cargo edition 2021.
- There are no external service dependencies (no database, no Docker, no network services).
- The `target/` directory is gitignored; builds are local-only.
