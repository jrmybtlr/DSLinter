import { createApp, h, shallowRef, nextTick, type Component } from "vue";
import type { CatalogComponent } from "../types/report";
import type { DemoNode } from "./recipes";
import type { FrameworkMount, PreviewAdapter } from "./protocol";
import { isMissingInjectionWarning, contextRequirement } from "./providerRecovery";

function isPreviewDefinition(
  value: unknown,
): value is {
  component: Component;
  decorate?: Component;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { __dslinterPreview?: unknown }).__dslinterPreview === true &&
    "component" in value
  );
}

export async function mount(
  container: HTMLElement,
  tree: DemoNode | string,
  components: Record<string, any>,
  component: CatalogComponent,
  initialValues: Record<string, unknown>,
  adapter: PreviewAdapter,
  emit: (event: string, value: unknown) => void,
  override?: Component,
): Promise<FrameworkMount> {
  const values = shallowRef(initialValues);
  let failure: Error | undefined;
  let mounting = true;
  let updating = false;
  function render(node: DemoNode | string): any {
    if (typeof node === "string") return node;
    const type = components[node.name] || node.name;
    const target = type === components[component.name] && node.target !== false;
    const props: Record<string, any> = { ...node.props, ...(target ? values.value : {}) };
    const slots: Record<string, () => any> = {};
    if (target) {
      for (const model of new Set([
        ...(component.preview.models || []),
        ...["modelValue", "value", "checked", "open"].filter((name) => name in props),
      ])) {
        props[`onUpdate:${model}`] = (value: unknown) => {
          values.value = { ...values.value, [model]: value };
          emit(`update:${model}`, value);
        };
      }
      for (const event of component.preview.emits || []) {
        const name = "on" + event.charAt(0).toUpperCase() + event.slice(1);
        props[name] ||= (value: unknown) => emit(event, value);
      }
      for (const name of component.preview.slots || []) {
        if (name === "default" && node.children?.some((child) => typeof child !== "string"))
          continue;
        slots[name] = () => String(values.value[`slot:${name}`] ?? `Example ${name}`);
      }
      for (const name of Object.keys(props)) if (name.startsWith("slot:")) delete props[name];
    }
    const defaultChildren = node.children?.filter(
      (child) => typeof child === "string" || !child.slot,
    );
    for (const child of node.children || []) {
      if (typeof child !== "string" && child.slot)
        slots[child.slot] = () =>
          target && values.value[`slot:${child.slot}`] !== undefined
            ? String(values.value[`slot:${child.slot}`])
            : child.children?.map(render);
    }
    if (defaultChildren?.length && !slots.default)
      slots.default = () => defaultChildren.map(render);
    if (typeof type === "string") return h(type, props, node.children?.map(render));
    return h(type, props, slots);
  }
  const app = createApp({
    render: () => {
      if (isPreviewDefinition(override)) {
        const node = h(override.component, values.value);
        return override.decorate ? h(override.decorate, { node }) : node;
      }
      return override ? h(override, values.value) : render(tree);
    },
  });
  function capture(error: unknown): void {
    if (!failure || contextRequirement(error))
      failure = error instanceof Error ? error : new Error(String(error));
    if (!mounting && !updating) emit("preview:error", failure.message);
  }
  try {
    adapter.vue?.setup?.(app);
    const previousError = app.config.errorHandler;
    const previousWarning = app.config.warnHandler;
    app.config.errorHandler = (error, instance, info) => {
      capture(error);
      previousError?.(error, instance, info);
    };
    app.config.warnHandler = (message, instance, trace) => {
      if (isMissingInjectionWarning(message)) capture(new Error(message));
      if (previousWarning) previousWarning(message, instance, trace);
      else if (!isMissingInjectionWarning(message)) console.warn(`[Vue warn]: ${message}${trace}`);
    };
    app.mount(container);
    await nextTick();
    if (failure) throw failure;
    mounting = false;
    return {
      async update(next) {
        updating = true;
        try {
          values.value = { ...values.value, ...next };
          await nextTick();
          if (failure) throw failure;
        } finally {
          updating = false;
        }
      },
      unmount() {
        app.unmount();
      },
    };
  } catch (error) {
    app.unmount();
    throw error;
  }
}
