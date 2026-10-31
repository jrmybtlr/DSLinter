import adapter from "virtual:dslinter/adapter";
document.documentElement.dataset.dslinterContext = "inertia";

const defaultPageProps = {
  auth: { user: { id: 1, name: "Example User", email: "example@example.test", avatar: "" } },
  errors: {},
};
let configuredPageProps: typeof adapter.pageProps;
let previewPageProps: (typeof defaultPageProps & Record<string, unknown>) | undefined;

export const page = {
  component: "DSLinterPreview",
  url: "/",
  version: null,
  get props() {
    // Adapters can import a component which imports this shim before the adapter initializes.
    const configured = adapter.pageProps;
    if (!previewPageProps || configured !== configuredPageProps) {
      configuredPageProps = configured;
      previewPageProps = { ...defaultPageProps, ...configured };
    }
    return previewPageProps;
  },
};
function record(event: string, detail: unknown) {
  window.dispatchEvent(
    new CustomEvent("dslinter:interaction", { detail: { event, value: detail } }),
  );
}
export const router = {
  on(name: string, callback: (event: Event) => void) {
    window.addEventListener(`inertia:${name}`, callback);
    return () => window.removeEventListener(`inertia:${name}`, callback);
  },
  ...Object.fromEntries(
    ["visit", "get", "post", "put", "patch", "delete", "reload", "replace"].map((name) => [
      name,
      (...args: unknown[]) =>
        record(
          `router.${name}`,
          args.filter((arg) => typeof arg === "string"),
        ),
    ]),
  ),
};
export function createInertiaApp() {}
export function setLayoutProps() {}
export function formData(initial: Record<string, unknown> = {}) {
  return {
    ...initial,
    errors: {},
    processing: false,
    progress: null,
    wasSuccessful: false,
    recentlySuccessful: false,
    isDirty: false,
    setData() {},
    reset() {},
    clearErrors() {},
    setError() {},
    defaults() {},
    transform() {},
    cancel() {},
    ...Object.fromEntries(
      ["submit", "get", "post", "put", "patch", "delete"].map((name) => [
        name,
        () => record(`form.${name}`, null),
      ]),
    ),
  };
}
export function useHttp() {
  return { submit: async () => ({}) };
}
