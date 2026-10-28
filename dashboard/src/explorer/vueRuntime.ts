import { createApp, h, shallowRef, nextTick, type Component } from "vue";
import type { CatalogComponent } from "../types/report";
import type { DemoNode } from "./recipes";
import type { FrameworkMount, PreviewAdapter } from "./protocol";

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
  function render(node: DemoNode | string): any {
    if (typeof node === "string") return node;
    const type = components[node.name] || node.name;
    const target = type === components[component.name];
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
  const app = createApp({ render: () => (override ? h(override, values.value) : render(tree)) });
  app.config.errorHandler = (error) => {
    failure = error instanceof Error ? error : new Error(String(error));
    emit("preview:error", failure.message);
  };
  try {
    adapter.vue?.setup?.(app);
    app.mount(container);
    await nextTick();
    if (failure) throw failure;
    return {
      update(next) {
        values.value = { ...values.value, ...next };
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
