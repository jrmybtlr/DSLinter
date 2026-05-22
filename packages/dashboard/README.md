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
npx dslinter init                         # scaffold .dslint.json + src/playground/buildRegistry.ts
npx dslinter                              # dev (watch + dashboard)
npx dslinter --report /path/to/repo --json
npx dslinter --report --output public/dslint-report.json
npx dslinter --watch --output public/dslint-report.json
```

Set `DSLINT_SERVE_PORT` to override the default scanner port (`7878`).
On first local run, `npx dslinter` scaffolds `.dslint.json` automatically if missing.

### Zero-config live previews (recommended)

**`npx dslinter .`** from your project root auto-merges the dslinter Vite plugin (playground module glob, scanner proxy, react dedupe). In your app:

```tsx
import { DashboardLayout, useWorkspaceReport } from "dslinter";

const dslinterReport = useWorkspaceReport({
  reportUrl: "/dslint-report.json",
  watchUrl: "/events",
});

<DashboardLayout autoPlayground dslinterReport={dslinterReport} tokenCatalog={...} />;
```

No `buildRegistry.ts` scaffold required. Works with Laravel/Inertia (`resources/js/Components/...`) and existing `@/*` → `resources/js/*` aliases.

**Direct `vite --mode serve`:** add one line to `vite.config.ts`:

```ts
import dslinter from "dslinter/vite";

export default defineConfig({
  plugins: [dslinter(), /* your plugins */],
});
```

The plugin sets `DSLINT_SCAN_ROOT` from the environment (set by `npx dslinter`) or defaults to `process.cwd()`.

### Consumer Vite (Laravel, Inertia, existing `@/*` aliases)

Published `dslinter` source uses **relative imports only** — your app's `@/*` alias does not hijack dslinter internal UI. You do **not** need `@/components` → `node_modules/dslinter` alias overrides.

### Laravel / Inertia embedded dashboard

When the dashboard lives inside your Inertia app (not only via `npx dslinter` dev):

| Step | Requirement |
|------|-------------|
| Scan | Always from the **project root**: `npx dslinter . --output public/dslint-report.json` |
| Dashboard | `<DashboardLayout autoPlayground dslinterReport={...} />` |
| Vite | `plugins: [dslinter()]` from `dslinter/vite` in `vite.config.js` |
| Report | `public/dslint-report.json` at the Laravel root (not under `resources/js/`) |

**Avoid** scanning a subdirectory such as `resources/js/Components` — `playgrounds[].rel_path` becomes bare filenames (`Button.tsx`) and breaks glob joins. If you must scan a subdir, dslinter still writes the report to the project `public/` when a parent `vite.config.*` exists, and may resolve previews via unique path suffixes when only one file matches.

**Init for Laravel:** `npx dslinter init --laravel` scaffolds `resources/js/playground/buildRegistry.ts` with a broad glob. Prefer `autoPlayground` unless you need custom playground controls.

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

## Live component previews (advanced / custom glob)

Use **`autoPlayground`** (above) for zero-config previews. Optionally scaffold a narrower glob for faster dev or custom controls:

- `npx dslinter init` → `src/playground/buildRegistry.ts`
- `npx dslinter init --laravel` → `resources/js/playground/buildRegistry.ts`

`npx dslinter init` now also scaffolds a starter `.dslint.json` (unless one already exists), including:
- `include_dirs` (directory scope for discovery)
- `ignore_globs` (file/directory ignores)
- `css_entrypoints` (main CSS entry files for token analysis)

```tsx
import { useMemo } from "react";
import { DashboardLayout, useWorkspaceReport } from "dslinter";
import { buildPlaygroundEntries } from "./playground/buildRegistry";

const dslinterReport = useWorkspaceReport({ reportUrl: "/dslint-report.json", watchUrl: "/events" });
const playgroundEntries = useMemo(
  () => buildPlaygroundEntries(dslinterReport.report),
  [dslinterReport.report],
);

<DashboardLayout playgroundEntries={playgroundEntries} dslinterReport={dslinterReport} />;
```

Or use `usePlaygroundFromReport(report)` with `dslinter/playground-modules` when the Vite plugin is active.

Run the scanner from the **project root** (`npx dslinter .`) so `playgrounds[].rel_path` matches your repo layout.

## Wiring the layout

`DashboardLayout` needs:

- **`autoPlayground`** (recommended) — or **`playgroundEntries`** from a custom registry / `usePlaygroundFromReport`.
- **`playgroundJoinSkips`** (optional) — auto-filled when using `autoPlayground`.
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
