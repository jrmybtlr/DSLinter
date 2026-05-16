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

This package exposes a **`dslinter` binary** that **forwards every argument to `dslint` on your PATH** (same flags as the Rust CLI: `--json`, `-o`, `--serve`, etc.). It does **not** bundle the Rust scanner.

```bash
npx dslinter /path/to/repo --json -o dslint-report.json
```

If `dslint` is not installed, you’ll get a short error with install hints (`cargo install dslint` once published, or build from this repo).

| Distribution | How users get `dslint` |
|--------------|-------------------------|
| **GitHub Releases** | Attach `dslint` (or `dslint.exe`) per OS/arch to each release; document download + `PATH`. |
| **crates.io** | Publish the crate as `dslint`; users run `cargo install dslint` (Rust toolchain required). |
| **npm** | `npx dslinter …` after `dslint` is on `PATH`, or a future dedicated wrapper with prebuilds. |

**Suggested path for this repo:** ship official binaries via **GitHub Releases** (CI builds with `cargo build --release` on `ubuntu`, `macos`, `windows`).

Typical usage after the CLI is on `PATH`:

```bash
dslint /path/to/repo --json -o dslint-report.json
# or --serve for live reload while developing a dashboard
# or equivalently:
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
