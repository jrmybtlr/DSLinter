# @dslinter/dashboard

React UI for the **DSLinter dashboard**: component playground shell, token wall, and governance panels. It expects a **`dslint-report.json`** file produced by the **`dslint`** CLI (Rust scanner in this repo).

## Peer dependencies

- `react` ^19
- `react-dom` ^19

## Install

```bash
npm install @dslinter/dashboard
```

This package is **source-first**: entry points resolve to TypeScript/TSX under `src/`. Use a bundler that transpiles dependencies from `node_modules` (for example Vite).

## Generating reports (Rust CLI)

This npm package **does not embed the scanner**. Install the CLI separately so you can scan a repo and emit JSON:

| Distribution | How users get `dslint` |
|--------------|-------------------------|
| **GitHub Releases** | Attach `dslint` (or `dslint.exe`) per OS/arch to each release; document download + `PATH`. |
| **crates.io** | Publish the crate as `dslint`; users run `cargo install dslint` (Rust toolchain required). |
| **npm binary wrapper** | Add a small package (e.g. `@dslinter/cli`) that uses [napi-rs](https://github.com/napi-rs/napi-rs), [prebuildify](https://github.com/prebuild/prebuildify), or a **postinstall script** that downloads the correct release asset for `process.platform` / `arch`. OptionalDependencies per platform is a common pattern. |

**Suggested path for this repo:** ship official binaries via **GitHub Releases** (CI builds with `cargo build --release` on `ubuntu`, `macos`, `windows`) and optionally add `@dslinter/cli` later that only downloads or shells out to that binary.

Typical usage after the CLI is on `PATH`:

```bash
dslint /path/to/repo --json -o dslint-report.json
# or --serve for live reload while developing a dashboard
```

## Styles (Tailwind v4)

1. In your app CSS, load Tailwind, then point Tailwind at this package so utility scanning picks up dashboard classes:

   ```css
   @import "tailwindcss";
   @source "../node_modules/@dslinter/dashboard/src";
   ```

2. Import the theme (tokens + shadcn layer):

   ```css
   @import "@dslinter/dashboard/theme.css";
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
} from "@dslinter/dashboard";
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
