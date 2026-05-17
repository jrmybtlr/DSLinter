# Changelog

## v0.0.18

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.17...v0.0.18)

## v0.0.17

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.16...v0.0.17)

### 🚀 Enhancements

- Refactor release process and update workflows ([20af684](https://github.com/jrmybtlr/DSLinter/commit/20af684))
- Add contributing guidelines and enhance documentation ([ac14afc](https://github.com/jrmybtlr/DSLinter/commit/ac14afc))

### 🏡 Chore

- Update Node version and GitHub Actions workflows ([612a9b0](https://github.com/jrmybtlr/DSLinter/commit/612a9b0))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.16

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.15...v0.0.16)

## v0.0.15

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.12...v0.0.15)

### 🚀 Enhancements

- Update release workflow and versioning ([5e28f64](https://github.com/jrmybtlr/DSLinter/commit/5e28f64))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.12

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.11...v0.0.12)

### 🚀 Enhancements

- Enhance GitHub release asset handling and logging ([4a62b9f](https://github.com/jrmybtlr/DSLinter/commit/4a62b9f))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.11

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.10...v0.0.11)

### 🩹 Fixes

- Update repository references from DSLint to DSLinter ([2dbae8d](https://github.com/jrmybtlr/DSLinter/commit/2dbae8d))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.10

[compare changes](https://github.com/jrmybtlr/DSLint/compare/v0.0.9...v0.0.10)

### 💅 Refactors

- Rename dslint to dslinter and update related configurations ([9f15898](https://github.com/jrmybtlr/DSLint/commit/9f15898))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.8

[compare changes](https://github.com/jrmybtlr/DSLint/compare/v0.0.7...v0.0.8)

## v0.0.7

[compare changes](https://github.com/jrmybtlr/DSLint/compare/v0.0.6...v0.0.7)

### 🚀 Enhancements

- Implement postinstall script to download prebuilt dslint binaries ([dae3072](https://github.com/jrmybtlr/DSLint/commit/dae3072))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.6

[compare changes](https://github.com/jrmybtlr/DSLint/compare/v0.0.5...v0.0.6)

## Unreleased

### Breaking changes

- **npm:** package renamed from `@dslinter/dashboard` to **`dslinter`**. Replace the dependency, imports (`dslinter`), and theme import (`dslinter/theme.css`).
- **CLI:** add **`dslinter`** binary that forwards arguments to **`dslint`** on `PATH` (Rust scanner not bundled).

### Enhancements

- **`postinstall`** attempts to download a **prebuilt `dslint`** for the current platform from **GitHub Releases** (tag `v` + package version). CI: `.github/workflows/release-dslint-binaries.yml`. Opt out with `DSLINT_SKIP_DOWNLOAD=1`.

## v0.0.5

[compare changes](https://github.com/jrmybtlr/DSLint/compare/v0.0.4...v0.0.5)

### 🏡 Chore

- Remove .npmrc file and update package versions ([615aa28](https://github.com/jrmybtlr/DSLint/commit/615aa28))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.4

[compare changes](https://github.com/jrmybtlr/DSLint/compare/v0.0.3...v0.0.4)

## v0.0.3

[compare changes](https://github.com/jrmybtlr/DSLint/compare/v0.0.2...v0.0.3)

## v0.0.2

### 🚀 Enhancements

- Add DSLint MVP — JSX/Vue scan, usage rollup, governance rules ([4d64b76](https://github.com/jrmybtlr/DSLint/commit/4d64b76))
- **demo:** Add Storybook-style dashboard for components and tokens ([4c6dbeb](https://github.com/jrmybtlr/DSLint/commit/4c6dbeb))
- Expand accessibility linting for JSX and Vue templates ([6b6937b](https://github.com/jrmybtlr/DSLint/commit/6b6937b))
- Add code smell rules (console, suppressions, inline style, …) ([df5cfd2](https://github.com/jrmybtlr/DSLint/commit/df5cfd2))
- Gitignore-aware scan, CI exits, suppressions, ownership, Vue fixes ([50ec564](https://github.com/jrmybtlr/DSLint/commit/50ec564))
- Gitignore negation (last-match wins) and token finding dedupe ([a433f7b](https://github.com/jrmybtlr/DSLint/commit/a433f7b))
- Prop analytics, hot reload, SSE serve, OnceLock regex perf ([93af74c](https://github.com/jrmybtlr/DSLint/commit/93af74c))
- Add token style findings and refactor module path resolution ([b0ae367](https://github.com/jrmybtlr/DSLint/commit/b0ae367))
- Initialize workspace structure and update demo components ([0e30ab2](https://github.com/jrmybtlr/DSLint/commit/0e30ab2))
- Enhance demo development experience and update components ([1f20f60](https://github.com/jrmybtlr/DSLint/commit/1f20f60))

### 🩹 Fixes

- Code review issues — keep-alive SSE, IMPLICIT_PROPS constant, Tailwind rotate class ([e0666cd](https://github.com/jrmybtlr/DSLint/commit/e0666cd))
- Remove leading whitespace from HTTP response headers in SSE server ([132a91b](https://github.com/jrmybtlr/DSLint/commit/132a91b))
- Skip default-export components in unused-prop analysis ([6fb2793](https://github.com/jrmybtlr/DSLint/commit/6fb2793))
- Implement all 7 review recommendations ([812e7fa](https://github.com/jrmybtlr/DSLint/commit/812e7fa))

### 💅 Refactors

- Consolidate playground exports using `definePlayground` ([9ce182f](https://github.com/jrmybtlr/DSLint/commit/9ce182f))
- Enhance demo structure and component registration ([3cd8181](https://github.com/jrmybtlr/DSLint/commit/3cd8181))

### 🏡 Chore

- Add oxfmt and oxlint at workspace root ([bb842d1](https://github.com/jrmybtlr/DSLint/commit/bb842d1))
- Update dependencies and configuration for React 19 ([4e5a54a](https://github.com/jrmybtlr/DSLint/commit/4e5a54a))
- Add TypeScript configuration and update demo settings ([6594c7c](https://github.com/jrmybtlr/DSLint/commit/6594c7c))

### 🎨 Styles

- Apply clippy lifetime elisions in ecma visitor ([34b0238](https://github.com/jrmybtlr/DSLint/commit/34b0238))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>
- Cursor Agent ([@cursoragent](https://github.com/cursoragent))
