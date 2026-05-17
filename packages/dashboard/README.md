# dslinter

React UI for the **DSLinter dashboard**: component playground shell, token wall, and governance panels. It expects a **`dslint-report.json`** file produced by the **`dslinter`** CLI (Rust scanner powered by [Oxc](https://oxc.rs) in this repo).

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

The **`dslinter`** command runs the design-system scanner with the same flags as the Rust CLI (`--json`, `-o`, `--serve`, etc.) via a **napi-rs** native binding (same distribution model as **`oxlint`**).

### Without installing Rust

On **`npm install dslinter`**, npm installs the platform **`@dslinter/binding-*`** optional dependency (darwin/linux/windows). No postinstall download or GitHub Releases API is required.

| Variable | Purpose |
|----------|---------|
| `DSLINT_BIN` | Use a cargo-built `dslinter` binary instead of the NAPI binding. |
| `DSLINT_ALLOW_PATH=1` | Allow `dslinter` on `PATH` when the binding is missing. |
| `NAPI_RS_NATIVE_LIBRARY_PATH` | Point at a specific `.node` file (napi-rs escape hatch). |

### Do not `cargo install dslint`

The crates.io crate **`dslint`** is a **different project**. Use **`cargo install --git https://github.com/jrmybtlr/DSLinter dslinter --locked`** or **`DSLINT_BIN`** for local Rust builds.

Typical usage:

```bash
dslinter /path/to/repo --json -o dslint-report.json
# or --serve for live reload while developing a dashboard
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
