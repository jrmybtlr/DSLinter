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

Configuration: [`.dslinter.json`](./.dslinter.json) scopes scans to `resources/js/components/`.

Optional embed in your own Inertia app: set `DSLINTER_USE_CONSUMER_VITE=1`, add `plugins: [dslinter()]` from `dslinter/vite`, and render `<DashboardLayout autoPlayground />` — see [`packages/dashboard/README.md`](../packages/dashboard/README.md).

## shadcn/ui components

Components live under `resources/js/components/ui/` as TypeScript TSX files.

The `/components` page demonstrates: Button, Card, Input, Label, Checkbox, Select, Dialog, Alert, Badge, Avatar, Dropdown Menu, Tooltip, Separator, Toggle, and Skeleton.

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
