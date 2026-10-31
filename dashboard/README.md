# dslinter

An automatic design-system explorer for React and Vue codebases. The npm package includes the CLI, dashboard, preview host, and native scanner bindings.

```sh
npm install -D dslinter
npx dslinter
```

No project files are created during default startup. DSLinter discovers your workspace, components, Vite apps, aliases, and styles; reports and generated assets live in a tool cache. Choose the preview application in the explorer or pass `--app <path-or-package-name>`.

See the [project guide](https://github.com/jrmybtlr/DSLinter#readme) for examples, reports, schema v4, adapters, and MCP.

## Preview adapters

`npx dslinter init` creates one optional `dslinter.preview.ts` file. Rename it to `.tsx` for JSX.

```ts
import type { PreviewAdapter } from "dslinter/preview";

export default {
  fixtures: {},
  previews: {},
  // styles: ["src/app.css"],
  // react: { wrap: (children) => createElement(Providers, null, children) },
  // vue: { setup: (app) => app.use(yourPlugin) },
  // pageProps: { auth: { user: sampleUser } },
} satisfies PreviewAdapter;
```

Keys accept unique names or source ids (`src/components/Button.tsx#Button`). Existing adjacent `.playground.tsx` files can supply React examples and controls. Automatic previews otherwise try captured usage, a matching composition recipe, and generated sample props/slots. Runtime errors stay within the frame.

Complete, verified examples can offer **Add preview setup**. This explicit action creates or safely merges the component's entry into the app's preview adapter and reloads the preview. It preserves configured entries; dynamic configurations keep the copyable example for manual setup.

## Legacy source embeds

The existing React source API is retained for applications already embedding the dashboard. These embeds require React 19 and a bundler that compiles TypeScript dependencies. The standalone explorer resolves the selected app's framework independently.

```tsx
import { DashboardLayout, useWorkspaceReport } from "dslinter";

const state = useWorkspaceReport({
  reportUrl: "/dslinter-report.json",
  watchUrl: "/events",
});

<DashboardLayout autoPlayground dslinterReport={state} />;
```

Add `dslinter/vite` and `dslinter/useclassy` to the consumer Vite plugins. For Tailwind v4, import the dashboard theme and register its sources:

```css
@import "tailwindcss";
@source "../node_modules/dslinter/src";
@source "../.classy/output.classy.html";
@import "dslinter/theme.css";
```

`DSLINTER_USE_CONSUMER_VITE=1 npx dslinter` selects this legacy flow. `npx dslinter init --legacy` scaffolds the original registry/config; existing config files are not overwritten.

## Distribution and checks

Node 22.12+ is required. Normal installs use the platform native binding; contributors can set `DSLINTER_BIN` to a cargo-built scanner.

```sh
pnpm --filter dslinter test
pnpm --filter dslinter exec tsc --noEmit
pnpm --filter dslinter run build:napi
pnpm --filter dslinter run build:dashboard
```

The release workflow publishes platform bindings and the main package together. Keep `Cargo.toml`, the npm package, and platform package versions aligned.
