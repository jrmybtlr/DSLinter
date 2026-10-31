import { defaultArgsFromControls } from "../types/controls";
import adapter from "virtual:dslinter/adapter";
import { mount } from "virtual:dslinter/framework";
import {
  PREVIEW_PROTOCOL,
  type PreviewCommand,
  type PreviewResponse,
  type PreviewProvenance,
  type FrameworkMount,
} from "./protocol";
import {
  demoFromExample,
  demoSnippet,
  demoWithValues,
  recipeFor,
  familyComponents,
  type DemoNode,
} from "./recipes";

import {
  recoverProviders,
  wrapProviders,
  PreviewContextError,
  contextAdapterExample,
  contextRequirement,
  notificationAdapterExample,
} from "./providerRecovery";
import type { ContextDiagnostic } from "./providerRecovery";
import { includesTarget } from "./familyRecipes";
import { hasVisiblePreview } from "./previewVisibility";
import { applyPreviewInset } from "./previewInset";
import { observePreviewSize } from "./previewSizing";
import { EMPTY_PREVIEW_MESSAGE } from "./previewMessages";
import type { ProviderCandidate } from "../types/report";

type Context = {
  root: string;
  moduleRoot?: string;
  moduleLoader?: boolean;
  app: string;
  framework: "react" | "vue";
  styles: string[];
  adapterRoot: string;
};

/** The frame imports only modules needed by the selected example. */
export function boot(context: Context): void {
  const parentOrigin =
    new URLSearchParams(location.search).get("parent") ||
    (parent !== window ? location.origin : null);
  if (!parentOrigin) return;
  const root = document.getElementById("dslinter-preview")!;
  document.body.style.margin = "0";
  root.style.cssText = "padding:64px;box-sizing:border-box";
  let active: FrameworkMount | undefined;
  let activeProviders: ProviderCandidate[] = [];
  let generation = 0;
  let command: PreviewCommand | undefined;
  let publishSnippet: ((values: Record<string, unknown>) => void) | undefined;
  let scanGeneration = 0;
  const providerCache = new Map<string, ProviderCandidate[]>();
  let renderQueue = Promise.resolve();
  let moduleEpoch = 0;
  const modules = new Map<string, Promise<Record<string, any>>>();
  function applyTheme(theme: "light" | "dark" = "light"): void {
    const html = document.documentElement;
    html.classList.toggle("dark", theme === "dark");
    html.dataset.theme = theme;
    html.dataset.dashboardTheme = theme;
    html.style.colorScheme = theme;
  }
  function send(message: Omit<PreviewResponse, "protocol">): void {
    if (message.type === "event" && message.value !== undefined) {
      const seen = new WeakSet();
      try {
        message.value = JSON.parse(
          JSON.stringify(message.value, (_, value) => {
            if (typeof value === "bigint") return String(value);
            if (typeof value === "function") return undefined;
            if (typeof Event !== "undefined" && value instanceof Event) return { type: value.type };
            if (value && typeof value === "object") {
              if (seen.has(value)) return "[circular]";
              seen.add(value);
            }
            return value;
          }),
        );
      } catch {
        message.value = String(message.value);
      }
    }
    parent.postMessage({ protocol: PREVIEW_PROTOCOL, ...message }, parentOrigin!);
  }
  const sizing = observePreviewSize(root, (height) => send({ type: "resize", height }));
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) sizing.disconnect();
  });
  function reportActiveFailure(error: unknown): void {
    const component = command?.component;
    const requirement = contextRequirement(error);
    let diagnostic: ContextDiagnostic | undefined;
    let example: string | undefined;
    if (component && requirement) {
      const candidates = (component.preview.provider_candidates || []).filter((provider) =>
        requirement.names.some(
          (name) =>
            provider.name === name ||
            provider.export_name === name ||
            provider.aliases?.includes(name),
        ),
      );
      diagnostic = {
        message: requirement.message,
        required: requirement.names,
        candidates,
        attemptedProviders: activeProviders,
        reason: requirement.names.length
          ? "Context failed after the preview mounted. Retry the preview to rerun provider recovery, or configure an explicit preview."
          : "The injection does not identify a provider component. Configure the service with vue.setup (app.provide or app.use).",
      };
      if (candidates.length <= 1)
        example = contextAdapterExample(component, candidates, context.adapterRoot, context.root);
    }
    active?.unmount();
    active = undefined;
    activeProviders = [];
    publishSnippet = undefined;
    send({
      type: "error",
      failurePhase: "update",
      message: error instanceof Error ? error.message : String(error),
      contextDiagnostic: diagnostic,
      adapterExample: example,
    });
  }
  async function load(path: string, specifier?: string): Promise<Record<string, any>> {
    const absolute =
      path.startsWith("/") || /^[A-Za-z]:/.test(path)
        ? path
        : `${context.root.replace(/\/$/, "")}/${path}`;
    // Match Vite's import URLs so providers share the consumer's context instance.
    const moduleRoot = (context.moduleRoot || context.root)
      .replaceAll("\\", "/")
      .replace(/\/$/, "");
    const normalized = absolute.replaceAll("\\", "/");
    const modulePath = normalized.startsWith(`${moduleRoot}/`)
      ? normalized.slice(moduleRoot.length)
      : `/@fs/${normalized.replace(/^\//, "")}`;
    const url =
      new URL(import.meta.url).origin +
      modulePath +
      (/\.(css|scss|less|sass)$/.test(path) ? "?import" : "");
    const key = `${path}:${specifier || ""}`;
    const entry = context.moduleLoader
      ? new URL(import.meta.url).origin +
        "/__dslinter/module.js?" +
        new URLSearchParams({
          ...(specifier ? { from: absolute, specifier } : { path: absolute }),
          epoch: String(moduleEpoch),
        })
      : url;
    if (!modules.has(key))
      modules.set(
        key,
        import(/* @vite-ignore */ entry)
          .then((module) => (context.moduleLoader ? module.default : module))
          .catch((error) => {
            modules.delete(key);
            throw error;
          }),
      );
    return modules.get(key)!;
  }

  function render(next: PreviewCommand): Promise<void> {
    scanGeneration++;
    command = next;
    const token = ++generation;
    renderQueue = renderQueue
      .catch(() => {})
      .then(async () => {
        if (generation === token) await renderAttempt(next, token);
      });
    return renderQueue;
  }
  async function renderAttempt(next: PreviewCommand, token: number): Promise<void> {
    active?.unmount();
    active = undefined;
    activeProviders = [];
    publishSnippet = undefined;
    if (next.type === "unmount" || !next.component) return;
    // Stage padding until mount; chrome surfaces replace it after render.
    root.style.padding = next.compact ? "32px" : "64px";
    sizing.reset(Boolean(next.compact));
    applyTheme(next.theme);
    const component = next.component;
    const catalog = next.catalog || [];
    const attempts: string[] = [];
    let contextDiagnostic: ContextDiagnostic | undefined;
    let adapterExample: string | undefined;
    try {
      for (const style of adapter.styles || [])
        await load(style.startsWith("/") ? style : `${context.adapterRoot}/${style}`);
      function configured<T>(items: Record<string, T> | undefined): T | undefined {
        if (items?.[component.id] !== undefined) return items[component.id];
        if (
          items?.[component.name] !== undefined &&
          catalog.filter((item) => item.name === component.name).length > 1
        )
          throw new Error(`Ambiguous adapter key ${component.name}; use ${component.id}`);
        return items?.[component.name];
      }
      const explicit = configured(adapter.previews);
      const strategies: {
        source: PreviewProvenance;
        tree: DemoNode | string;
        override?: unknown;
      }[] = [];
      if (explicit)
        strategies.push({ source: "override", tree: { name: component.name }, override: explicit });
      if (!explicit && component.preview.manual_preview && component.framework === "react") {
        try {
          const manual = component.preview.manual_preview;
          const override = (await load(manual.rel_path))[manual.export_name];
          if (override)
            strategies.push({ source: "override", tree: { name: component.name }, override });
        } catch (error) {
          attempts.push(`manual override: ${String(error)}`);
        }
      }
      const recipe = recipeFor(component, catalog);
      const subcomponent =
        /^(?:DropdownMenu|NavigationMenu|Collapsible|Breadcrumb|ToggleGroup|InputOTP|Avatar|Dialog|Select|Sheet|Card|Tooltip|Sidebar)(?=[A-Z])/.test(
          component.name,
        );
      if (recipe && subcomponent) strategies.push({ source: "recipe", tree: recipe });
      if (component.preview.example_tree)
        strategies.push({ source: "usage", tree: demoFromExample(component.preview.example_tree) });
      if (recipe && !subcomponent) strategies.push({ source: "recipe", tree: recipe });
      strategies.push({
        source: "generated",
        tree: {
          name: component.name,
          children:
            component.preview.declared_props.includes("children") ||
            component.preview.slots?.includes("default")
              ? ["Example"]
              : [],
        },
      });
      for (const strategy of strategies) {
        if (generation !== token) return;
        try {
          const exported = strategy.override
            ? undefined
            : (await load(component.preview.rel_path))[component.preview.export_name];
          if (!strategy.override && !exported)
            throw new Error(
              `Export ${component.preview.export_name} was not found in ${component.preview.rel_path}`,
            );
          const resolved: Record<string, unknown> = exported ? { [component.name]: exported } : {};
          const family = familyComponents(component, catalog);
          async function resolveTree(tree: DemoNode | string): Promise<void> {
            if (typeof tree === "string") return;
            if (/^[A-Z]/.test(tree.name) && !resolved[tree.name]) {
              const binding = component.bindings[tree.name];
              const candidate =
                catalog.find((item) => item.id === binding) ||
                family.find((item) => item.name === tree.name) ||
                catalog.find(
                  (item) =>
                    item.id ===
                    component.preview.provider_candidates?.find(
                      (provider) => provider.name === tree.name,
                    )?.id,
                );
              if (candidate)
                resolved[tree.name] = (await load(candidate.preview.rel_path))[
                  candidate.preview.export_name
                ];
              else {
                const [base, ...members] = tree.name.split(".");
                const binding = component.preview.source_imports?.[base];
                if (!binding)
                  throw new Error(
                    `Example dependency ${tree.name} needs an import binding or fixture`,
                  );
                const imported = await load(binding.importer, binding.specifier);
                let value = binding.export_name === "*" ? imported : imported[binding.export_name];
                for (const member of members) value = value?.[member];
                if (!value) throw new Error(`Example import ${tree.name} could not be resolved`);
                resolved[tree.name] = value;
              }
            }
            await Promise.all((tree.children || []).map(resolveTree));
          }
          if (!strategy.override) {
            const targets = new Set([
              component.name,
              ...Object.keys(component.bindings).filter(
                (name) => component.bindings[name] === component.id,
              ),
            ]);
            if (!includesTarget(strategy.tree, targets))
              throw new Error("Example does not contain the selected component");
            await resolveTree(strategy.tree);
          }
          if (generation !== token) return;
          function selectedProps(tree: DemoNode | string): Record<string, unknown> | undefined {
            if (typeof tree === "string") return;
            if (
              tree.target !== false &&
              (tree.name === component.name || component.bindings[tree.name] === component.id)
            )
              return tree.props;
            return tree.children?.map(selectedProps).find(Boolean);
          }
          let values = {
            ...defaultArgsFromControls(
              (strategy.override as { playgroundControls?: PreviewResponse["controls"] })
                ?.playgroundControls,
            ),
            ...component.preview.sample_props,
            ...selectedProps(strategy.tree),
            ...next.values,
            ...configured(adapter.fixtures),
          };
          const revealedValues: Record<string, string | boolean> = {};
          const cacheKey = `${component.id}:${strategy.source}:${JSON.stringify([strategy.tree, component.preview.provider_candidates])}`;
          const authoritative = Boolean(
            strategies.some((item) => item.override) ||
            (context.framework === "react" ? adapter.react?.wrap : adapter.vue?.setup),
          );
          const recovered = await recoverProviders({
            component,
            candidates: component.preview.provider_candidates || [],
            initial: providerCache.get(cacheKey) || [],
            authoritative,
            present: catalog
              .filter((item) =>
                Object.entries(resolved).some(
                  ([name]) =>
                    component.bindings[name] === item.id ||
                    (item.preview.rel_path === component.preview.rel_path && item.name === name),
                ),
              )
              .map((item) => item.id),
            current: () => generation === token,
            onFailure: (message) => attempts.push(`${strategy.source}: ${message}`),
            async attempt(providers) {
              for (const provider of providers) {
                const exportedProvider = (await load(provider.rel_path))[provider.export_name];
                if (!exportedProvider)
                  throw new Error(`Provider export ${provider.id} was not found`);
                if (resolved[provider.name] && resolved[provider.name] !== exportedProvider)
                  throw new Error(
                    `Provider name ${provider.name} conflicts with an example binding`,
                  );
                resolved[provider.name] = exportedProvider;
              }
              if (generation !== token) throw new Error("Preview superseded");
              const performMount = () =>
                mount(
                  root,
                  wrapProviders(strategy.tree, providers, adapter.fixtures),
                  resolved,
                  component,
                  values,
                  adapter,
                  (event: string, value: unknown) => {
                    if (generation !== token) return;
                    if (event === "preview:error")
                      queueMicrotask(() => {
                        if (generation === token && active) reportActiveFailure(value);
                      });
                    else send({ type: "event", event, value });
                  },
                  strategy.override,
                );

              let session = await performMount();
              // Allow image loads and portal/layout effects to settle before assessing visibility.
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              );
              if (generation !== token) {
                session.unmount();
                throw new Error("Preview superseded");
              }
              if (!hasVisiblePreview(root) && !authoritative) {
                const candidates = (component.preview.visibility_props || [])
                  .filter(
                    (key) =>
                      !next.explicitKeys?.includes(key) &&
                      configured(adapter.fixtures)?.[key] === undefined &&
                      values[key] !== true,
                  )
                  .slice(0, 4);
                for (const key of candidates) {
                  session.unmount();
                  const original = values;
                  const reveal = component.preview.visibility_values?.[key] ?? true;
                  values = { ...values, [key]: reveal };
                  session = await performMount();
                  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                  if (generation !== token) {
                    session.unmount();
                    throw new Error("Preview superseded");
                  }
                  if (hasVisiblePreview(root)) {
                    revealedValues[key] = reveal;
                    break;
                  }
                  values = original;
                }
              }
              if (!hasVisiblePreview(root)) {
                session.unmount();
                throw new Error(EMPTY_PREVIEW_MESSAGE);
              }
              return session;
            },
          });
          if (!recovered) return;
          const { result: session, providers } = recovered;
          if (generation !== token) {
            session.unmount();
            return;
          }
          active = session;
          activeProviders = providers;
          providerCache.set(cacheKey, providers);
          applyPreviewInset(root, Boolean(next.compact));
          const targetNames = new Set([
            component.name,
            ...Object.entries(resolved)
              .filter(([, value]) => value === exported)
              .map(([name]) => name),
          ]);
          publishSnippet = (nextValues) =>
            send({
              type: "rendered",
              provenance: strategy.source,
              attempts,
              suppliedProviders: providers,
              revealedValues,
              snippet: demoSnippet(
                wrapProviders(
                  demoWithValues(strategy.tree, targetNames, nextValues),
                  providers,
                  adapter.fixtures,
                ),
                context.framework,
              ),
              substitutedContext: document.documentElement.dataset.dslinterContext === "inertia",
              styles: context.styles,
              synthetic:
                Object.keys(revealedValues).length > 0 ||
                providers.length > 0 ||
                strategy.source === "generated" ||
                strategy.source === "recipe" ||
                Object.keys(component.preview.sample_props || {}).length > 0 ||
                Object.keys(nextValues).some((key) => key.startsWith("slot:")),
              values: Object.fromEntries(
                Object.entries(nextValues).filter(([, value]) =>
                  ["string", "number", "boolean"].includes(typeof value),
                ),
              ) as Record<string, string | number | boolean>,
              controls: (strategy.override as { playgroundControls?: PreviewResponse["controls"] })
                ?.playgroundControls,
            });
          publishSnippet(values);
          requestAnimationFrame(() => {
            if (generation === token) sizing.schedule();
          });
          return;
        } catch (error) {
          if (generation !== token) return;
          if (error instanceof PreviewContextError) {
            contextDiagnostic = error.diagnostic;
            // Ambiguous imports require a deliberate choice; do not emit a misleading example.
            if (contextDiagnostic.candidates.length <= 1)
              adapterExample = contextAdapterExample(
                component,
                [
                  ...new Map(
                    [...contextDiagnostic.attemptedProviders, ...contextDiagnostic.candidates].map(
                      (provider) => [provider.id, provider],
                    ),
                  ).values(),
                ],
                context.adapterRoot,
                context.root,
              );
            else adapterExample = undefined;
          }
          active?.unmount();
          root.replaceChildren();
          const attempt = `${strategy.source}: ${error instanceof Error ? error.message : String(error)}`;
          if (attempts.at(-1) !== attempt) attempts.push(attempt);
        }
      }
      throw new Error(
        "Every automatic preview strategy failed. Add fixtures, providers, or a preview override in dslinter.preview.tsx.",
      );
    } catch (error) {
      if (generation === token) {
        const notificationExample =
          !contextDiagnostic &&
          attempts.length > 0 &&
          attempts.every((attempt) => attempt.endsWith(EMPTY_PREVIEW_MESSAGE))
            ? notificationAdapterExample(component, context.adapterRoot, context.root)
            : undefined;
        send({
          type: "error",
          failurePhase: "render",
          message: error instanceof Error ? error.message : String(error),
          attempts,
          contextDiagnostic,
          adapterExample: adapterExample || notificationExample,
          setupAction:
            notificationExample &&
            !attempts.some((attempt) => /^(?:override|manual override):/.test(attempt))
              ? "notification"
              : undefined,
        });
      }
    }
  }
  window.addEventListener("message", (event: MessageEvent<PreviewCommand>) => {
    if (
      event.source !== parent ||
      event.origin !== parentOrigin ||
      event.data?.protocol !== PREVIEW_PROTOCOL
    )
      return;
    const next = event.data;
    if (next.type === "scan-a11y") {
      const token = ++scanGeneration;
      const renderToken = generation;
      void (async () => {
        try {
          const [{ scanElementA11y }, { default: axe }] = await Promise.all([
            import("../playground/scanVariantA11y"),
            import("virtual:dslinter/axe"),
          ]);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          if (
            token !== scanGeneration ||
            renderToken !== generation ||
            !document.body ||
            !root.isConnected
          )
            return;
          const findings = await scanElementA11y(
            document.body,
            next.requestId || "Live preview",
            axe,
          );
          if (token === scanGeneration && renderToken === generation)
            send({ type: "a11y", findings, requestId: next.requestId });
        } catch (error) {
          if (token === scanGeneration && renderToken === generation)
            send({ type: "a11y", message: String(error), requestId: next.requestId });
        }
      })();
      return;
    }
    if (next.theme) applyTheme(next.theme);
    if (next.type === "update" && active) {
      scanGeneration++;
      const session = active;
      const token = generation;
      if (command) command = { ...command, values: { ...command.values, ...next.values } };
      const values = command?.values || {};
      void (async () => {
        try {
          await session.update(next.values || {});
          if (generation !== token || active !== session) return;
          applyPreviewInset(root, Boolean(command?.compact));
          publishSnippet?.(values);
        } catch (error) {
          if (generation !== token || active !== session) return;
          reportActiveFailure(error);
        }
      })();
    } else if (next.type === "update" && command?.component) {
      void render({
        ...command,
        ...next,
        type: "mount",
        values: { ...command.values, ...next.values },
      });
    } else void render(next);
  });
  window.addEventListener("error", (event) =>
    send({ type: "error", failurePhase: active ? "update" : "render", message: event.message }),
  );
  window.addEventListener("unhandledrejection", (event) =>
    send({
      type: "error",
      failurePhase: active ? "update" : "render",
      message: String(event.reason),
    }),
  );
  window.addEventListener("dslinter:interaction", (event) => {
    const detail = (event as CustomEvent).detail;
    send({ type: "event", event: detail.event, value: detail.value });
  });
  document.addEventListener("click", (event) => {
    const link = (event.target as Element).closest?.("a[href]");
    if (link) {
      event.preventDefault();
      send({ type: "event", event: "navigate", value: link.getAttribute("href") });
    }
  });
  document.addEventListener("submit", (event) => {
    event.preventDefault();
    send({ type: "event", event: "submit" });
  });
  if (import.meta.hot)
    import.meta.hot.on("vite:afterUpdate", () => {
      moduleEpoch++;
      modules.clear();
      providerCache.clear();
      if (command) void render(command);
    });
  send({ type: "ready" });
}
