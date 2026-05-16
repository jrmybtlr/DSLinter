# dslinter

React UI for the **DSLinter dashboard**: component playground shell, token wall, and governance panels. It expects a **`dslint-report.json`** file produced by the **`dslint`** CLI (Rust scanner in this repo).

**Previously published as `@dslinter/dashboard`.** Migrate with `npm install dslinter` and replace imports `@dslinter/dashboard` → `dslinter`, and `@dslinter/dashboard/theme.css` → `dslinter/theme.css`.

## Peer dependencies

- `react` ^19
- `react-dom` ^19

## Install

```bash
npm install dslinter
```

This package is **source-first**: entry points resolve to TypeScript/TSX under `src/`. Use a bundler that transpiles dependencies from `node_modules` (for example Vite).

## CLI (`npx dslinter`)

The **`dslinter` binary** runs the **`dslint`** scanner with the same flags as the Rust CLI (`--json`, `-o`, `--serve`, etc.).

### Without installing Rust

On **`npm install dslinter`**, a **`postinstall`** script tries to download a **prebuilt `dslint`** for your OS/arch from this repo’s **GitHub Releases**, using the **same tag as the npm version** (for example npm `dslinter@0.0.6` → release **`v0.0.6`** and assets like `dslint-x86_64-unknown-linux-gnu`). The binary is stored under `node_modules/dslinter/vendor/` and `dslinter` / `npx dslinter` prefer it over `PATH`.

**Release workflow:** push git tag `v*` (after bumping the npm version) so [.github/workflows/release-dslint-binaries.yml](https://github.com/jrmybtlr/DSLint/blob/main/.github/workflows/release-dslint-binaries.yml) uploads the platform binaries, **then** publish `dslinter` to npm (or publish after the workflow finishes so installs resolve the assets).

Environment variables:

| Variable | Purpose |
|----------|---------|
| `DSLINT_SKIP_DOWNLOAD=1` | Skip postinstall download (air-gapped / you only use `PATH`). |
| `DSLINT_RELEASE_TAG` | Override release tag (default `v` + `dslinter` version from `package.json`). |
| `DSLINT_GITHUB_REPO` | Override `owner/repo` for downloads (default `jrmybtlr/DSLint`). |

### How this differs from `oxlint`

**`oxlint`** on npm ships **Node native addons** as **`optionalDependencies`** (`@oxlint/binding-darwin-arm64`, …) built with **napi-rs** — each package is a small prebuilt library loaded by Node.

**`dslint`** is a **standalone executable**. The practical pattern here is **download on install** from **GitHub Releases** (similar in spirit to tools that pull a platform binary once), instead of publishing dozens of `@dslinter/binding-*` packages.

### If there is no matching release asset yet

You’ll see a **warning** during install (install still succeeds) and **`dslinter`** falls back to **`dslint` on your PATH**, or prints install hints if missing:

```bash
npx dslinter /path/to/repo --json -o dslint-report.json
```

| Distribution | How users get `dslint` |
|--------------|-------------------------|
| **npm + GitHub Releases** | Default: postinstall download when release `vX.Y.Z` includes your platform asset. |
| **GitHub Releases** | Manual download of `dslint-*` from the release; add to `PATH`. |
| **crates.io** | `cargo install dslint` once published. |

Typical usage:

```bash
dslint /path/to/repo --json -o dslint-report.json
# or --serve for live reload while developing a dashboard
# or equivalently (vendored or PATH):
dslinter /path/to/repo --json -o dslint-report.json
```

## Styles (Tailwind v4)

1. In your app CSS, load Tailwind, then point Tailwind at this package so utility scanning picks up dashboard classes:

   ```css
   @import "tailwindcss";
   @source "../node_modules/dslinter/src";
   ```

2. Import the theme (tokens + shadcn layer):

   ```css
   @import "dslinter/theme.css";
   ```

## Wiring the layout

`DashboardLayout` needs:

- **`playgroundEntries`** — from the report’s `playgrounds` list joined to your React modules (see repo `demo/src/playground/buildRegistry.ts`).
- **`tokenCatalog`** — token wall data (see `demo/src/tokenCatalog.ts`).
- **`dslinterReport`** — from `useWorkspaceReport({ reportUrl: "/dslint-report.json", ... })`.

```tsx
import { useMemo } from "react";
import {
  useWorkspaceReport,
  DashboardLayout,
} from "dslinter";
import { buildPlaygroundEntries } from "./playground/buildRegistry";
import { tokenCatalog } from "./tokenCatalog";

export default function App() {
  const dslinterReport = useWorkspaceReport({
    reportUrl: "/dslint-report.json",
    refreshIntervalMs: 5000,
  });

  const playgroundEntries = useMemo(
    () => buildPlaygroundEntries(dslinterReport.report),
    [dslinterReport.report],
  );

  return (
    <DashboardLayout
      playgroundEntries={playgroundEntries}
      tokenCatalog={tokenCatalog}
      dslinterReport={dslinterReport}
    />
  );
}
```

`DashboardLayout` wraps content in `DashboardThemeProvider`. Use `useDashboardTheme` for custom chrome.

## License

Apache-2.0. See [LICENSE](./LICENSE).
