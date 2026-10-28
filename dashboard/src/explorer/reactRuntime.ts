import * as React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
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
  override?: any,
): Promise<FrameworkMount> {
  const root = createRoot(container);
  let update: (values: Record<string, unknown>) => void = () => {};
  let failure: Error | undefined;
  class Boundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
    state = { error: false };
    static getDerivedStateFromError() {
      return { error: true };
    }
    componentDidCatch(error: Error) {
      failure = error;
      emit("preview:error", error.message);
    }
    render() {
      return this.state.error ? null : this.props.children;
    }
  }
  function Demo() {
    const [values, setValues] = React.useState(initialValues);
    update = (next) => setValues((current) => ({ ...current, ...next }));
    function render(node: DemoNode | string, key: number | string): React.ReactNode {
      if (typeof node === "string") return node;
      const type = components[node.name] || node.name;
      const target = type === components[component.name];
      const props: Record<string, any> = { ...node.props, ...(target ? values : {}), key };
      if (target) {
        for (const [event, prop] of [
          ["onValueChange", "value"],
          ["onCheckedChange", "checked"],
          ["onOpenChange", "open"],
        ]) {
          if (props[prop] === undefined && !component.preview.declared_props.includes(event))
            continue;
          const callback = props[event];
          props[event] = (value: unknown) => {
            setValues((current) => ({ ...current, [prop]: value }));
            emit(event, value);
            if (typeof callback === "function") callback(value);
          };
        }
        const change = props.onChange;
        props.onChange = (event: any) => {
          const value =
            event?.target?.type === "checkbox" ? event.target.checked : event?.target?.value;
          setValues((current) => ({
            ...current,
            [event?.target?.type === "checkbox" ? "checked" : "value"]: value,
          }));
          emit("onChange", value);
          if (typeof change === "function") change(event);
        };
        for (const name of new Set([
          "onClick",
          ...component.preview.declared_props.filter((name) => /^on[A-Z]/.test(name)),
        ])) {
          if (props[name]) continue;
          props[name] = (...args: unknown[]) =>
            emit(
              name,
              args.filter(
                (arg) => arg == null || ["string", "boolean", "number"].includes(typeof arg),
              ),
            );
        }
      }
      const composed = node.children?.some((child) => typeof child !== "string");
      const children =
        target && !composed && typeof values.children === "string"
          ? [values.children]
          : node.children;
      return React.createElement(
        type,
        props,
        ...(children || []).map((child, index) => render(child, `${key}.${index}`)),
      );
    }
    let child: React.ReactNode;
    if (override?.PlaygroundPreview)
      child = React.createElement(override.PlaygroundPreview, { values });
    else child = override ? React.createElement(override, values) : render(tree, "root");
    return adapter.react?.wrap ? (adapter.react.wrap(child) as React.ReactNode) : child;
  }
  try {
    flushSync(() => root.render(React.createElement(Boundary, null, React.createElement(Demo))));
    if (failure) throw failure;
    return {
      update(values) {
        flushSync(() => update(values));
        if (failure) throw failure;
      },
      unmount() {
        root.unmount();
      },
    };
  } catch (error) {
    root.unmount();
    throw error;
  }
}
