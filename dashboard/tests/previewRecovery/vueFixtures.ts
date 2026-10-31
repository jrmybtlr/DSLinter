import { defineComponent, h, inject, provide, ref } from "vue";
const key = Symbol("browser-test");
export const TestProvider = defineComponent({
  setup(_, { slots }) {
    provide(key, "provided");
    return () => slots.default?.();
  },
});
export const NeedsContext = defineComponent({
  props: ["label"],
  setup(props) {
    const context = inject(key, null);
    if (!context)
      throw new Error(
        "Injection `Symbol(browser-test)` not found. Component must be used within `TestProvider`",
      );
    return () => h("button", `${props.label || "Vue ready"}: ${context}`);
  },
});
export const BareInjection = defineComponent({
  setup() {
    inject("unknown-service");
    return () => h("span", "Missing service");
  },
});
export const UpdateFailure = defineComponent({
  props: ["fail"],
  setup(props) {
    return () => {
      if (props.fail) throw new Error("Component must be used within `TestProvider`");
      return h("span", "Ready for update");
    };
  },
});

export const VisibilityGate = defineComponent({
  props: { showContent: Boolean },
  setup(props) {
    return () => (props.showContent ? h("span", "Revealed content") : null);
  },
});
export default TestProvider;

export const EmptyComponent = defineComponent({ setup: () => () => null });
export const UnrelatedFailure = defineComponent({
  setup() {
    throw new Error("Unexpected demo failure");
  },
});

export const ViewportFill = defineComponent({
  setup() {
    const reached = ref(false);
    return () =>
      h(
        "div",
        {
          style: { minHeight: "100svh", padding: "32px", display: "flex", flexDirection: "column" },
        },
        [
          h("span", "Viewport-sized preview"),
          h(
            "button",
            {
              style: { marginTop: "auto" },
              onClick: () => {
                reached.value = true;
              },
            },
            reached.value ? "Bottom reached" : "Bottom action",
          ),
        ],
      );
  },
});
