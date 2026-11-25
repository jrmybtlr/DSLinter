import { defineComponent, h, reactive } from "vue";
import { page, formData } from "./inertiaShared";
export { router, createInertiaApp, setLayoutProps, useHttp } from "./inertiaShared";
export function usePage() {
  return page;
}
export function useForm(initial: Record<string, unknown> = {}) {
  return reactive(formData(initial));
}
export const Head = defineComponent({
  setup(_, { slots }) {
    return () => slots.default?.();
  },
});
export const Link = defineComponent({
  props: ["href"],
  setup(props, { attrs, slots }) {
    return () =>
      h(
        "a",
        { ...attrs, href: props.href || "#", onClick: (event: Event) => event.preventDefault() },
        slots.default?.(),
      );
  },
});
export const Form = defineComponent({
  setup(_, { slots }) {
    return () =>
      h(
        "form",
        { onSubmit: (event: Event) => event.preventDefault() },
        slots.default?.(formData()),
      );
  },
});
