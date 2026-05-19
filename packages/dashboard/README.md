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

The **`dslinter`** command orchestrates the Rust scanner (via **napi-rs**, same distribution model as **`oxlint`**) and, in a Vite host app, the dashboard dev loop.

| Mode | Flag | Behavior |
|------|------|----------|
| Dev (default locally) | _(none)_ | `--serve`, watch, write `--output`, start Vite `--mode serve` |
| Report | `--report` | One-shot scan; human stdout or `--json`; `--output` writes JSON |
| Watch | `--watch` | Watch + write JSON only |
| Build | `--build` | One-shot report to `--output`, then `vite build` |
| CI default | `CI=true` | Same as `--report` |

Scanner flags: `--json`, `-p` / `--parallel`, `--fail-on-warnings`, `--max-warnings`, `--output`, `[PATH]`. Low-level: `--serve <port>` (watch + HTTP, no Vite).

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
npx dslinter init                         # scaffold src/playground/buildRegistry.ts
npx dslinter                              # dev (watch + dashboard)
npx dslinter --report /path/to/repo --json
npx dslinter --report --output public/dslint-report.json
npx dslinter --watch --output public/dslint-report.json
```

Set `DSLINT_SERVE_PORT` to override the default scanner port (`7878`). Your Vite config should proxy `/dslint-report.json` and `/events` to that port in `serve` mode (see repo `demo/vite.config.ts`).

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

## Live component previews (consumer Vite apps)

If the dashboard shows **“Scan snapshot — no live preview”** for a component that appears in the catalog, the scanner found the file but Vite did not load it. Wire previews in three steps:

1. **Scaffold** (optional): `npx dslinter init` → `src/playground/buildRegistry.ts`; for Inertia/Laravel (`resources/js/…`) use `npx dslinter init --laravel`
2. **Glob** must cover nested paths, e.g. `import.meta.glob("../components/**/*.{tsx,jsx}", { eager: true })`
3. **App**: pass `playgroundEntries` and `playgroundJoinSkips` from the registry into `DashboardLayout`

```tsx
import { useMemo } from "react";
import { DashboardLayout, useWorkspaceReport } from "dslinter";
import {
  buildPlaygroundEntries,
  getPlaygroundJoinSkips,
} from "./playground/buildRegistry";

const dslinterReport = useWorkspaceReport({
  reportUrl: "/dslint-report.json",
  watchUrl: "/events",
});

const playgroundEntries = useMemo(
  () => buildPlaygroundEntries(dslinterReport.report),
  [dslinterReport.report],
);
const playgroundJoinSkips = useMemo(
  () => getPlaygroundJoinSkips(dslinterReport.report),
  [dslinterReport.report],
);

<DashboardLayout
  playgroundEntries={playgroundEntries}
  playgroundJoinSkips={playgroundJoinSkips}
  dslinterReport={dslinterReport}
/>;
```

In dev, skipped joins are also logged to the console. The inspect pane shows the expected Vite glob key when a preview fails.

Run the scanner from the **project root** (`npx dslinter .`) so `playgrounds[].rel_path` matches your repo layout.

## Wiring the layout

`DashboardLayout` needs:

- **`playgroundEntries`** — from the report’s `playgrounds` list joined to your React modules (see repo `demo/src/playground/buildRegistry.ts`).
- **`playgroundJoinSkips`** (optional) — from `buildPlaygroundEntriesFromReportWithSkips` for richer inspect-pane hints.
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
