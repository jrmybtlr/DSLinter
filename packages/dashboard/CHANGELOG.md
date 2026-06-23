# Changelog

## v0.5.0

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.4.0...v0.5.0)

### 🚀 Enhancements

- **dashboard:** Enhance dev banner with network and scanner information ([ef5f1c8](https://github.com/jrmybtlr/DSLinter/commit/ef5f1c8))

### 🩹 Fixes

- **dashboard:** Update inline style handling and improve linting for color values ([70a7d1d](https://github.com/jrmybtlr/DSLinter/commit/70a7d1d))

### 💅 Refactors

- **dashboard:** Update dev banner and button component styles ([3baa3d1](https://github.com/jrmybtlr/DSLinter/commit/3baa3d1))

### 🏡 Chore

- Update package-lock.json and pnpm-lock.yaml, add SECURITY.md, and enhance version checks for native bindings ([9d29b82](https://github.com/jrmybtlr/DSLinter/commit/9d29b82))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.4.0

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.3.0...v0.4.0)

### 🚀 Enhancements

- **dashboard:** Enhance style value extraction and token validation ([0754b61](https://github.com/jrmybtlr/DSLinter/commit/0754b61))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.3.0

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.2.3...v0.3.0)

### 🚀 Enhancements

- **dashboard:** Add new components and enhance reporting features ([e65ca9b](https://github.com/jrmybtlr/DSLinter/commit/e65ca9b))
- **dashboard:** Enhance prop type classification and add support for ReactNode ([fd3a37a](https://github.com/jrmybtlr/DSLinter/commit/fd3a37a))

### 🩹 Fixes

- **dashboard:** Update isDashboardPackageSrc function to accept package root ([3492f84](https://github.com/jrmybtlr/DSLinter/commit/3492f84))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.2.3

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.2.2...v0.2.3)

### 🚀 Enhancements

- **report:** Upgrade schema version to 3 and refactor JSON serialization ([b53a3fb](https://github.com/jrmybtlr/DSLinter/commit/b53a3fb))

### 🩹 Fixes

- **requireNative:** Update expected version for native bindings to 0.2.1 ([c836736](https://github.com/jrmybtlr/DSLinter/commit/c836736))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.2.2

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.2.1...v0.2.2)

### ✅ Tests

- **collectScanModules:** Enhance case sensitivity tests for include_dirs ([32c2065](https://github.com/jrmybtlr/DSLinter/commit/32c2065))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.2.1

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.2.0...v0.2.1)

### 🩹 Fixes

- **ci:** Build NAPI and demo report before publish tests ([fdf497d](https://github.com/jrmybtlr/DSLinter/commit/fdf497d))
- **report-cache:** Improve report path validation by ensuring report root matches project root ([7510dde](https://github.com/jrmybtlr/DSLinter/commit/7510dde))

### 💅 Refactors

- Enhance path resolution for include directories and improve case sensitivity handling ([22c96fb](https://github.com/jrmybtlr/DSLinter/commit/22c96fb))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.2.0

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.13...v0.2.0)

### 🚀 Enhancements

- **website:** Switch deploy config from pages to workers ([22d7e35](https://github.com/jrmybtlr/DSLinter/commit/22d7e35))
- **playground:** Add user info playground component and enhance controls handling ([625f7c2](https://github.com/jrmybtlr/DSLinter/commit/625f7c2))

### 🔥 Performance

- Precompute newline_offsets once in analyze_vue_file, pass to merge_template_usages ([a2839b3](https://github.com/jrmybtlr/DSLinter/commit/a2839b3))

### 🩹 Fixes

- **dashboard:** Address PR review feedback on publish files and API export ([d3a1f1b](https://github.com/jrmybtlr/DSLinter/commit/d3a1f1b))
- Import website main stylesheet in entrypoint ([79fa1ec](https://github.com/jrmybtlr/DSLinter/commit/79fa1ec))
- Remove duplicate typescript devDependency in dashboard package ([03e3dc1](https://github.com/jrmybtlr/DSLinter/commit/03e3dc1))
- Address review comments - remove duplicate typescript dep, add .d.mts declaration, remove dead code ([cbfd7ab](https://github.com/jrmybtlr/DSLinter/commit/cbfd7ab))

### 💅 Refactors

- **rust:** Consolidate usage maps, DRY FileScan ctors, remove scan_and_evaluate, fix scoring bugs, use lazy_regex! ([5033b13](https://github.com/jrmybtlr/DSLinter/commit/5033b13))
- **ts:** Split playground module, useRef cancellation, Set dedup, useMemo fixes, DashboardLayout, Sidebar, barrel index ([d57a673](https://github.com/jrmybtlr/DSLinter/commit/d57a673))

### 📖 Documentation

- Update README config options ([5f2be14](https://github.com/jrmybtlr/DSLinter/commit/5f2be14))
- Remove trailing spaces in README ([1fc4c1d](https://github.com/jrmybtlr/DSLinter/commit/1fc4c1d))

### 🏡 Chore

- **release:** V0.1.13 ([3cd1a20](https://github.com/jrmybtlr/DSLinter/commit/3cd1a20))
- **dashboard:** Remove dead code and dedupe helpers ([cb41bcd](https://github.com/jrmybtlr/DSLinter/commit/cb41bcd))
- Begin optimisation pass over src/ and packages/dashboard ([8ec1a34](https://github.com/jrmybtlr/DSLinter/commit/8ec1a34))
- Plan cloudflare workers website deploy ([affabf5](https://github.com/jrmybtlr/DSLinter/commit/affabf5))
- Add semver as a dev dependency and update pnpm lockfile ([18afb12](https://github.com/jrmybtlr/DSLinter/commit/18afb12))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>
- Cursor Agent ([@cursoragent](https://github.com/cursoragent))

## v0.1.13

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.12...v0.1.13)

### 🏡 Chore

- **release:** V0.1.12 ([7c2190a](https://github.com/jrmybtlr/DSLinter/commit/7c2190a))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.1.12

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.10...v0.1.12)

### 🏡 Chore

- **release:** V0.1.11 ([bc2d134](https://github.com/jrmybtlr/DSLinter/commit/bc2d134))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.1.11

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.10...v0.1.11)

## v0.1.10

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.8...v0.1.10)

### 🏡 Chore

- **release:** V0.1.9 ([a54ea04](https://github.com/jrmybtlr/DSLinter/commit/a54ea04))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.1.8

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.7...v0.1.8)

### 🚀 Enhancements

- Auto-scaffold dslint config and add scan scope options ([572e97b](https://github.com/jrmybtlr/DSLinter/commit/572e97b))

### 🩹 Fixes

- Warn when css_entrypoint path is missing ([88a5038](https://github.com/jrmybtlr/DSLinter/commit/88a5038))
- Don't scope CSS discovery to include_dirs ([7e6df94](https://github.com/jrmybtlr/DSLinter/commit/7e6df94))

## v0.1.7

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.5...v0.1.7)

### 🏡 Chore

- **release:** V0.1.6 ([1463fbc](https://github.com/jrmybtlr/DSLinter/commit/1463fbc))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.1.6

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.5...v0.1.6)

## v0.1.5

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.4...v0.1.5)

## v0.1.4

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.3...v0.1.4)

## Unreleased

### 🚀 Enhancements

- **`dslinter/vite` plugin** — virtual `playground-modules` map keyed by `@dslint-scan/<rel_path>`; scanner proxy, react dedupe, `optimizeDeps.exclude`, and `server.fs.allow` for the scan root.
- **`DashboardLayout autoPlayground`** and **`usePlaygroundFromReport`** — zero-config live previews without `buildRegistry.ts`.
- **`npx dslinter`** auto-merges the plugin into consumer Vite via `vite/consumer.config.mjs` when a host app is detected.

### 🩹 Fixes

- Remove `@/` path aliases from published `src/` so host apps with their own `@/*` Vite alias (Laravel/Inertia, etc.) no longer resolve dslinter UI imports to the wrong tree.

## v0.1.3

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.2...v0.1.3)

## v0.1.2

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.1...v0.1.2)

## v0.1.1

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.1.0...v0.1.1)

## v0.1.0

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.35...v0.1.0)

### 🏡 Chore

- Update native binding version checks to 0.0.34 in dashboard package ([917860a](https://github.com/jrmybtlr/DSLinter/commit/917860a))
- **release:** V0.0.37 ([abdda70](https://github.com/jrmybtlr/DSLinter/commit/abdda70))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.35

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.34...v0.0.35)

### 🏡 Chore

- Update dependencies and improve dashboard functionality ([71a42f2](https://github.com/jrmybtlr/DSLinter/commit/71a42f2))
- Update @napi-rs/cli to version 3.6.2 and refactor ANSI regex in dev-banner ([dd264b2](https://github.com/jrmybtlr/DSLinter/commit/dd264b2))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.34

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.33...v0.0.34)

### 🩹 Fixes

- Update native binding version checks to 0.0.33 and improve type definitions in ComponentPlaygroundPane ([99ad1e6](https://github.com/jrmybtlr/DSLinter/commit/99ad1e6))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.33

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.32...v0.0.33)

### 🏡 Chore

- **release:** V0.0.32 ([bb07996](https://github.com/jrmybtlr/DSLinter/commit/bb07996))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.32

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.31...v0.0.32)

## v0.0.31

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.30...v0.0.31)

## v0.0.30

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.29...v0.0.30)

## v0.0.29

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.28...v0.0.29)

### 💅 Refactors

- Enhance dashboard directory resolution and improve dev mode output ([5670315](https://github.com/jrmybtlr/DSLinter/commit/5670315))

### 🏡 Chore

- Update GitHub Actions and package.json ([b9541b2](https://github.com/jrmybtlr/DSLinter/commit/b9541b2))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.28

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.27...v0.0.28)

### 🏡 Chore

- Update dashboard build process and CLI commands ([43c71d6](https://github.com/jrmybtlr/DSLinter/commit/43c71d6))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.27

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.26...v0.0.27)

### 🩹 Fixes

- **ci:** Prepublish skip optional npm publish ([b69b368](https://github.com/jrmybtlr/DSLinter/commit/b69b368))
- **ci:** Disable npm provenance on publish (retry-safe) ([5aaece8](https://github.com/jrmybtlr/DSLinter/commit/5aaece8))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.26

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.25...v0.0.26)

### 🩹 Fixes

- **ci:** Skip gh-release in napi prepublish ([cdcda0e](https://github.com/jrmybtlr/DSLinter/commit/cdcda0e))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.25

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.24...v0.0.25)

### 🩹 Fixes

- **ci:** Single macos job + mold on publish ([b2a193d](https://github.com/jrmybtlr/DSLinter/commit/b2a193d))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.24

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.23...v0.0.24)

### 🩹 Fixes

- **ci:** Skip lifecycle scripts and install mold for Rust job ([e85d8d9](https://github.com/jrmybtlr/DSLinter/commit/e85d8d9))
- **ci:** Build x86_64-apple-darwin on macos-latest ([bcc1af8](https://github.com/jrmybtlr/DSLinter/commit/bcc1af8))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.23

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.22...v0.0.23)

## v0.0.22

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.21...v0.0.22)

## v0.0.21

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.19...v0.0.21)

### 🏡 Chore

- **release:** V0.0.20 ([c07bb96](https://github.com/jrmybtlr/DSLinter/commit/c07bb96))

### ❤️ Contributors

- Jeremy Butler <jeremy.butler@laravel.com>

## v0.0.20

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.19...v0.0.20)

## v0.0.19

[compare changes](https://github.com/jrmybtlr/DSLinter/compare/v0.0.18...v0.0.19)

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
