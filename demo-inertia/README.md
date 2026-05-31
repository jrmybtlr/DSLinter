# demo-inertia

Laravel 13 + Inertia 3 + React 19 + Vite 8 + Tailwind CSS 4 + shadcn/ui, with [DSLinter](https://github.com/jeremybutler/DSLint) via the **CLI and Vite plugin** (no manual dashboard wiring in this app).

Scaffolded with the [official Laravel React starter kit](https://laravel.com/docs/13.x/starter-kits#react).

## Stack

| Layer | Technology |
|-------|------------|
| Backend | Laravel 13, Fortify auth |
| Frontend | Inertia 3, React 19, TypeScript |
| Build | Vite 8, `laravel-vite-plugin`, `@inertiajs/vite` |
| UI | shadcn/ui in `resources/js/components/ui/*.tsx` |
| DSLinter | `npx dslinter` from this directory (see below) |

## Prerequisites

- PHP 8.3+
- Composer
- Node.js 22+
- SQLite (default database)

## First-time setup

From the **repository root** (links `dslinter` via pnpm workspace):

```bash
pnpm install
```

Then in `demo-inertia`:

```bash
composer install
cp .env.example .env   # if .env is missing
php artisan key:generate
touch database/database.sqlite
php artisan migrate --force
npm run build
```

## Run the Laravel app

```bash
composer run dev
```

Or:

```bash
php artisan serve
npm run dev
```

Open **http://127.0.0.1:8000/** (Laravel — not the Vite port).

| URL | Description |
|-----|-------------|
| `/dashboard` | Starter kit dashboard |
| `/components` | Showcase of 15 shadcn/ui components |

## DSLint (governance + component previews)

`dslinter` is linked from the monorepo (`"dslinter": "workspace:*"`), same as [`demo/`](../demo/). From `demo-inertia/`:

```bash
npx dslinter
# or
pnpm run dslinter:dev
```

The CLI merges `dslinter/vite` automatically, writes `public/dslinter-report.json`, and opens the dashboard UI (see the terminal banner for the URL, typically port **5175**).

Configuration: [`.dslinter.json`](./.dslinter.json) scopes scans and playground previews to `resources/js/components/`.

Optional embed in your own Inertia app: set `DSLINTER_USE_CONSUMER_VITE=1`, add `plugins: [dslinter()]` from `dslinter/vite`, and render `<DashboardLayout autoPlayground />` — see [`packages/dashboard/README.md`](../packages/dashboard/README.md).

## shadcn/ui components

Components live under `resources/js/components/ui/` as TypeScript TSX files.

The `/components` page demonstrates: Button, Card, Input, Label, Checkbox, Select, Dialog, Alert, Badge, Avatar, Dropdown Menu, Tooltip, Separator, Toggle, and Skeleton.

### Live preview (DSLinter dashboard)

Compound shadcn components (dropdown menus, dialogs, sheets, selects, etc.) **do not need** co-located `*.playground.tsx` files when the scanner report is available. The dashboard detects compound families (root + trigger + content exports) and builds composed previews automatically.

Controls are inferred from `declared_props` in the scan plus real repo usage (`usage_by_component`). For example, `DropdownMenuContent` picks up an `align` select when call sites use `align="end"` and `align="start"`.

Run `pnpm run dslinter:report` (or `npx dslinter`) and open `/component/DropdownMenu` to see the live preview.

For components that need a custom demo, add a co-located playground file:

```
resources/js/components/ui/
  alert.tsx
  alert.playground.tsx   ← definePlaygroundFromKit() escape hatch
```

Playground files are excluded from the component catalog via `ignore_globs` in [`.dslinter.json`](./.dslinter.json). Manual previews override auto-generated ones with the same catalog id.

For `definePlaygroundFromKit`, list control keys as an array to use each prop name as the default (e.g. `controls: ['title', 'description']`). Use a record when a prop needs a custom default (`controls: { placeholder: 'Pick a stack' }`).

```bash
npx shadcn@latest add switch
```

## Scripts

| Script | Purpose |
|--------|---------|
| `composer run dev` | Laravel + queue + logs + Vite |
| `npm run dev` | Vite only |
| `npx dslinter` / `pnpm run dslinter:dev` | DSLint dashboard + scanner |
| `pnpm run dslinter:report` | One-off scan |
| `npm run build` | Production assets |
| `php artisan test` | Pest tests |
