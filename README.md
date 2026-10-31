# DSLinter

Explore the design system already in your codebase. DSLinter discovers React and Vue components, opens live examples with controls, and connects each component to its usage across your workspace.

The Rust scanner uses Oxc for JavaScript/TypeScript analysis. A separate preview host uses your application's framework, Vite transforms, aliases, assets, and CSS. Components load when selected, so a broken import or render stays inside its preview.

## Start

```sh
npm install -D dslinter
npx dslinter
```

DSLinter opens the Dashboard URL in your browser. No config, stories, app routes, Vite edits, or generated project files are required. Reports and generated assets go to an external tool cache. Set `DSLINTER_OPEN_BROWSER=0` to keep browser opening disabled.

In a workspace, the catalog aggregates local packages. Choose the application that supplies preview dependencies and styling in the app selector, or select it at startup:

```sh
npx dslinter --app apps/web
npx dslinter --app my-app-package-name
npx dslinter path/to/project
```

Without an explicit path, DSLinter discovers the containing workspace or application. An explicit path restricts the scan boundary. `include_dirs` in existing `.dslinter.json` files restricts the catalog, while usage is still counted outside those directories within the scan boundary. Nested ignore files are respected.

## Live examples

DSLinter tries, in order:

1. An explicit preview adapter or an existing adjacent `.playground.tsx` example.
2. A representative source usage with its imports and literal values.
3. A built-in composition recipe.
4. A generated example with bounded sample data inferred from types.

Generated data, automatically revealed content, and substituted Inertia context are labelled. Object-array samples retain their structure, and untouched optional controls leave component defaults intact. Family recipes include the selected export and its required ancestors; content previews open their owner when needed. Component and provider imports use Vite-managed module entries to share context across hot updates. If all strategies fail, the explorer shows the attempts and error alongside the API and source usage. It never removes a component merely because its preview failed.

The initial recipe set covers Button, Input, Checkbox, Switch, Card, Dialog, Select, Tabs, Popover, and Tooltip. React shadcn compositions and Vue/Reka compositions use their actual exports. Customized or incomplete contracts fall back to source examples and generated demos. React and Vue previews can recover from missing-provider errors when exactly one matching export is verified in the component's local source dependencies. DSLinter mounts that real provider, labels the supplied context, and includes it in copied snippets. Canonical-id adapter fixtures can supply provider props. Recovery stops at four added providers; ambiguous requirements and bare Vue injection warnings show configuration guidance. Explicit previews and configured wrappers remain authoritative. Providers requiring application services or backend data may still need an adapter.

Supported preview hosts are React and Vue 3 applications using Vite, including Laravel/Inertia. Next.js and Nuxt runtime integration are outside this release. The dashboard retains token and governance views, CI reporting, baseline drift, and MCP access.

The original dashboard layout is available throughout the explorer: grouped component navigation, command search, light/dark themes, governance scores, issue filters, and the full inventory table. Component pages include the API reference, repository call sites, related components, token findings, code/accessibility scores, and a resizable preview with screen/container presets. Variant previews are paginated and load near the viewport; color-contrast checks run inside the loaded application frames.

Hide Component affects this browser's catalog preferences and can be undone from the sidebar. It does not create or edit project configuration.

## One optional adapter

```sh
npx dslinter init
```

This explicitly creates `dslinter.preview.ts`; it does not create a registry or JSON config. Use `.tsx` when the adapter contains JSX. Existing adapters are kept.

```tsx
import type { PreviewAdapter } from "dslinter/preview";
import { AppProviders } from "./src/providers";
import UserCardExample from "./src/examples/UserCardExample";

export default {
  styles: ["src/app.css"],
  fixtures: {
    UserCard: { user: { name: "Jane", email: "jane@example.test" } },
  },
  previews: { UserCard: UserCardExample },
  react: { wrap: (children) => <AppProviders>{children}</AppProviders> },
  // Vue applications can use vue: { setup: (app) => app.use(yourPlugin) }.
  // Inertia: pageProps: { auth: { user: sampleUser } }.
} satisfies PreviewAdapter;
```

Styles resolve relative to the adapter. Fixture and preview keys accept a unique component name or a canonical id such as `packages/ui/src/UserCard.tsx#UserCard`. Use the id when names are duplicated. An app-local adapter takes precedence over the workspace adapter.

For complete, verified examples such as a Sonner notification host, the explorer offers **Add preview setup**. Clicking it creates the app's `dslinter.preview.ts` or adds the component's entry to the existing adapter, then reloads the preview. Existing entries are preserved. Dynamic configurations and setups that still need user-supplied data retain the copyable example for manual configuration. Startup and automatic recovery do not create project files.

Existing `definePlayground` APIs and embedded dashboards remain available. `npx dslinter init --legacy` retains the original JSON config and registry scaffolding; `DSLINTER_USE_CONSUMER_VITE=1` selects the original embedded dev flow. See [the package guide](dashboard/README.md).

## Reports and CI

```sh
npx dslinter --report
npx dslinter --report --json
npx dslinter --report --output public/dslinter-report.json
npx dslinter --watch
npx dslinter --report --fail-on-warnings
npx dslinter --report --update-baseline
npx dslinter --report --diff-baseline
npx dslinter --report --fail-on-drift
```

In CI, the default command runs a one-shot report. Explicit `--output` and baseline-update commands write the requested artifacts. Normal reports, watch mode, and the explorer use the tool cache (`~/Library/Caches/dslinter` on macOS, the user's cache directory on Linux, and LocalAppData on Windows). Override it with `DSLINTER_CACHE_DIR`.

Schema v4 adds `components`, an import-aware catalog containing:

- `id`: source-relative module plus resolved declaration/export identity.
- `name`, `framework`, and `preview`: export location, props, variants, inferred data, slots/models, and examples.
- `usages`: resolved source locations, including aliases, barrel imports, and local workspace packages.
- `bindings` and `example_source`: example dependencies and provenance.

Legacy `files`, `playgrounds`, and name-based `usage_by_component` fields remain. The explorer normalizes v3 reports without guessing which duplicate definition owns a name-only reference. MCP accepts canonical ids; ambiguous names return candidate ids.

## MCP

```json
{
  "mcpServers": {
    "dslinter": {
      "command": "npx",
      "args": ["dslinter", "mcp"]
    }
  }
}
```

Tools expose scans, catalog entries, component APIs, usage examples, findings, tokens, policy, agent context, and baseline drift. `DSLINTER_SCAN_ROOT`, `DSLINTER_REPORT_PATH`, and `DSLINTER_MCP_DEV_URL` override their defaults.

## Development

```sh
cargo test
pnpm --filter dslinter test
pnpm --filter dslinter exec tsc --noEmit
pnpm --filter dslinter run build:napi
pnpm --filter dslinter run build:dashboard
# Requires permission to listen on loopback ports:
DSLINTER_E2E=1 pnpm --filter dslinter exec vitest run bin/modes/explore.integration.test.mjs
```

The fixtures include React, React/Inertia, Vue, Vue/Inertia components, and shared workspace exports. The lifecycle test checks startup, preview-host generation, changed-file rescanning, shutdown, and an unchanged project file tree.

See [CONTRIBUTING.md](CONTRIBUTING.md) for native distribution and release workflows. The supported CLI is `dslinter`; the similarly named crates.io `dslint` is a different project.
