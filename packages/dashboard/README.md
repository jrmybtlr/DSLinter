# dslinter

React UI for the **DSLinter dashboard**: component playground shell, token wall, and governance panels. It expects a **`dslinter-report.json`** file produced by the **`dslinter`** CLI (Rust scanner powered by [Oxc](https://oxc.rs) in this repo).

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
| Report | `--report` | One-shot scan; human stdout or `--json`; `--output` writes JSON; enriches playground prop kinds/options from TypeScript when `tsconfig.json` is present |
| Watch | `--watch` | Watch + write JSON only; re-enriches playgrounds after each scan |
| Build | `--build` | One-shot report to `--output` (with TS enrichment), then `vite build` |
| MCP | `mcp` | Stdio MCP server for AI agents (catalog, findings, agent context) |
| CI default | `CI=true` | Same as `--report` |

Scanner flags: `--json`, `-p` / `--parallel`, `--fail-on-warnings`, `--max-warnings`, `--output`, `[PATH]`. Low-level: `--serve <port>` (watch + HTTP, no Vite).

### Without installing Rust

On **`npm install dslinter`**, npm installs the platform **`@dslinter/binding-*`** optional dependency (darwin/linux/windows). No postinstall download or GitHub Releases API is required.

| Variable | Purpose |
|----------|---------|
| `DSLINTER_BIN` | Use a cargo-built `dslinter` binary instead of the NAPI binding. |
| `DSLINTER_ALLOW_PATH=1` | Allow `dslinter` on `PATH` when the binding is missing. |
| `NAPI_RS_NATIVE_LIBRARY_PATH` | Point at a specific `.node` file (napi-rs escape hatch). |

### Do not `cargo install dslint`

The crates.io crate **`dslint`** is a **different project**. Use **`cargo install --git https://github.com/jrmybtlr/DSLinter dslinter --locked`** or **`DSLINTER_BIN`** for local Rust builds.

Typical usage:

```bash
npx dslinter                              # dev (watch + dashboard) — run from any project subdirectory
npx dslinter --yes                        # dev + auto-create .dslinter.json and public/ without prompting
npx dslinter init                         # optional: scaffold buildRegistry.ts for custom controls
npx dslinter --report demo --json
npx dslinter --report --output public/dslinter-report.json
npx dslinter --watch --output public/dslinter-report.json
```

Set `DSLINTER_SERVE_PORT` to override the default scanner port (`7878`).
When dev mode prints both a **Dashboard** URL and a **Scanner API** URL, open the **Dashboard** URL for the UI (port 7878 is the scanner API only).

On first local run in an interactive terminal, `npx dslinter` asks whether to create minimal setup files (`.dslinter.json` and `public/`). In CI or with `--yes`, those files are created automatically. Set `DSLINTER_NO_SCAFFOLD=1` to skip all writes.

| Flag / variable | Purpose |
|-----------------|--------|
| `--yes` / `-y` | Create minimal scaffold without prompting |
| `DSLINTER_NO_SCAFFOLD=1` | Never write scaffold files |
| `DSLINTER_USE_CONSUMER_VITE=1` | Use your app's Vite dev server as the dashboard UI (embedded `<DashboardLayout />`) |
| `DSLINTER_NO_EMBED_VITE=1` | Disable standalone embed dashboard dev server |

### Zero-config live previews (recommended)

Run **`npx dslinter`** from your repo (including `resources/js/Components` or other subdirectories — the CLI resolves the project root automatically). For **Laravel / Inertia** apps, dev mode starts a **standalone DSLinter dashboard** with live previews; you do **not** need to add `<DashboardLayout />` to your Inertia app.

Previews load your components with your Vite `@/` aliases and Inertia stubs (`usePage`, `<Link>`, etc.) so isolated components render without a full page visit.

The embed dev server registers Tailwind `@source` paths for your `.dslinter.json` **`include_dirs`** (for example `resources/js/components`), so component utility classes like `px-3.5` are generated in preview CSS. For 100% parity with your app's full CSS pipeline (theme entry, `@custom-variant`, etc.), use `DSLINTER_USE_CONSUMER_VITE=1` instead.

The prebuilt **`dashboard-dist`** bundle shipped on npm does not run this Vite transform; use embed dev mode (monorepo / git checkout) or consumer Vite for accurate preview styling.

For apps that already embed the dashboard (like this repo's `demo/`), dev mode uses your app's Vite server when `src/App.tsx` imports `DashboardLayout` from `dslinter`.

**Direct `vite --mode serve`:** add one line to `vite.config.ts`:

```ts
import dslinter from "dslinter/vite";

export default defineConfig({
  plugins: [dslinter(), /* your plugins */],
});
```

The plugin sets `DSLINTER_SCAN_ROOT` from the environment (set by `npx dslinter`) or defaults to `process.cwd()`.

### Consumer Vite (Laravel, Inertia, existing `@/*` aliases)

Published `dslinter` source uses **relative imports only** — your app's `@/*` alias does not hijack dslinter internal UI. You do **not** need `@/components` → `node_modules/dslinter` alias overrides.

### Laravel / Inertia (zero app code)

```bash
cd my-laravel-app
npx dslinter
```

Open the **Dashboard** URL from the terminal banner (default port `5175`). The scanner writes `public/dslinter-report.json` at the project root.

No Inertia route, no `buildRegistry.ts`, and no `vite.config` edits are required for dev previews.

**Optional — embed dashboard in your app:** set `DSLINTER_USE_CONSUMER_VITE=1`, add `plugins: [dslinter()]` from `dslinter/vite`, and render `<DashboardLayout autoPlayground dslinterReport={...} />`.

**Optional — custom playground controls:** `npx dslinter init --laravel` scaffolds `resources/js/playground/buildRegistry.ts`.

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

`npx dslinter init` now also scaffolds a starter `.dslinter.json` (unless one already exists), including:
- `include_dirs` (directory scope for discovery)
- `ignore_globs` (file/directory ignores)
- `css_entrypoints` (main CSS entry files for token analysis)

```tsx
import { useMemo } from "react";
import { DashboardLayout, useWorkspaceReport } from "dslinter";
import { buildPlaygroundEntries } from "./playground/buildRegistry";

const dslinterReport = useWorkspaceReport({ reportUrl: "/dslinter-report.json", watchUrl: "/events" });
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
- **`dslinterReport`** — from `useWorkspaceReport({ reportUrl: "/dslinter-report.json", ... })`.

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
    reportUrl: "/dslinter-report.json",
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
