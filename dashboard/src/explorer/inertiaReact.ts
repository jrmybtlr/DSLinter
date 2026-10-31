import { createElement, Fragment, useState } from "react";
import { page, formData } from "./inertiaShared";
export { router, createInertiaApp, setLayoutProps, useHttp } from "./inertiaShared";
export function usePage() {
  return page;
}
export function Head({ children }: any) {
  return createElement(Fragment, null, children);
}
export function Link({ href = "#", children, ...props }: any) {
  return createElement(
    "a",
    { ...props, href, onClick: (event: Event) => event.preventDefault() },
    children,
  );
}
export function Form({ children }: any) {
  return createElement(
    "form",
    { onSubmit: (event: Event) => event.preventDefault() },
    typeof children === "function" ? children(formData()) : children,
  );
}
export function useForm(initial: Record<string, unknown> = {}) {
  const [data, setData] = useState(initial);
  return {
    ...formData(data),
    data,
    setData: (key: string | Record<string, unknown>, value?: unknown) =>
      setData((previous) => (typeof key === "string" ? { ...previous, [key]: value } : key)),
  };
}
