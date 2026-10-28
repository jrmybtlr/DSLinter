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

type Context = {
  root: string;
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
  root.style.cssText = "min-height:240px;padding:32px;box-sizing:border-box";
  let active: FrameworkMount | undefined;
  let generation = 0;
  let command: PreviewCommand | undefined;
  let publishSnippet: ((values: Record<string, unknown>) => void) | undefined;
  const modules = new Map<string, Promise<Record<string, any>>>();
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
  async function load(path: string): Promise<Record<string, any>> {
    const absolute =
      path.startsWith("/") || /^[A-Za-z]:/.test(path)
        ? path
        : `${context.root.replace(/\/$/, "")}/${path}`;
    const url =
      new URL(import.meta.url).origin +
      `/@fs/${absolute.replace(/^\//, "")}${/\.(css|scss|less|sass)$/.test(path) ? "?import" : ""}`;
    if (!modules.has(path))
      modules.set(
        path,
        import(/* @vite-ignore */ url).catch((error) => {
          modules.delete(path);
          throw error;
        }),
      );
    return modules.get(path)!;
  }
  async function render(next: PreviewCommand): Promise<void> {
    command = next;
    const token = ++generation;
    active?.unmount();
    active = undefined;
    if (next.type === "unmount" || !next.component) return;
    const component = next.component;
    const catalog = next.catalog || [];
    const attempts: string[] = [];
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
      if (component.preview.example_tree)
        strategies.push({ source: "usage", tree: demoFromExample(component.preview.example_tree) });
      const recipe = recipeFor(component, catalog);
      if (recipe) strategies.push({ source: "recipe", tree: recipe });
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
                family.find((item) => item.name === tree.name);
              if (!candidate)
                throw new Error(
                  `Example dependency ${tree.name} needs an import binding or fixture`,
                );
              resolved[tree.name] = (await load(candidate.preview.rel_path))[
                candidate.preview.export_name
              ];
            }
            await Promise.all((tree.children || []).map(resolveTree));
          }
          if (!strategy.override) await resolveTree(strategy.tree);
          if (generation !== token) return;
          const values = {
            ...component.preview.sample_props,
            ...next.values,
            ...configured(adapter.fixtures),
          };
          const session = await mount(
            root,
            strategy.tree,
            resolved,
            component,
            values,
            adapter,
            (event: string, value: unknown) => {
              if (event === "preview:error") send({ type: "error", message: String(value) });
              else send({ type: "event", event, value });
            },
            strategy.override,
          );
          if (generation !== token) {
            session.unmount();
            return;
          }
          if (
            !root.childElementCount &&
            !root.textContent?.trim() &&
            !document.body.querySelector(
              '[role="dialog"],[role="listbox"],[data-radix-popper-content-wrapper],[data-reka-popper-content-wrapper]',
            )
          ) {
            session.unmount();
            throw new Error(
              "Component produced no visible content; a composition or slot may be required",
            );
          }
          active = session;
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
              snippet: demoSnippet(
                demoWithValues(strategy.tree, targetNames, nextValues),
                context.framework,
              ),
              substitutedContext: document.documentElement.dataset.dslinterContext === "inertia",
              styles: context.styles,
              synthetic:
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
          return;
        } catch (error) {
          active?.unmount();
          root.replaceChildren();
          attempts.push(
            `${strategy.source}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      throw new Error(
        "Every automatic preview strategy failed. Add fixtures, providers, or a preview override in dslinter.preview.ts.",
      );
    } catch (error) {
      if (generation === token)
        send({
          type: "error",
          message: error instanceof Error ? error.message : String(error),
          attempts,
        });
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
    if (next.type === "update" && active) {
      try {
        if (command) command = { ...command, values: { ...command.values, ...next.values } };
        active.update(next.values || {});
        publishSnippet?.(command?.values || {});
      } catch (error) {
        send({ type: "error", message: String(error) });
      }
    } else void render(next);
  });
  window.addEventListener("error", (event) => send({ type: "error", message: event.message }));
  window.addEventListener("unhandledrejection", (event) =>
    send({ type: "error", message: String(event.reason) }),
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
      modules.clear();
      if (command) void render(command);
    });
  send({ type: "ready" });
}
