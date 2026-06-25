import type { ReactNode } from "react";

/** Minimal Inertia stubs for dslinter component previews (no Laravel backend). */

/** No-op entry bootstrap when `app.tsx` is pulled into the playground graph. */
export function createInertiaApp(_options: Record<string, unknown>) {
  return undefined;
}

/** No-op layout prop helper used by some auth pages. */
export function setLayoutProps(_props: Record<string, unknown>) {
  return undefined;
}

const emptyPage = {
  component: "Preview",
  props: {} as Record<string, unknown>,
  url: "/",
  version: null as string | null,
  clearHistory: false,
  encryptHistory: false,
  rememberedState: {} as Record<string, unknown>,
  scrollRegions: [] as unknown[],
};

export function usePage<T extends Record<string, unknown> = Record<string, unknown>>() {
  return {
    ...emptyPage,
    props: {} as T,
  };
}

export function Link({
  href = "#",
  children,
  ...rest
}: {
  href?: string;
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

export function Head({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/** Stub for components that use Inertia `<Form>` in playground previews. */
export function Form({
  children,
  ...rest
}: {
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return <form {...rest}>{children}</form>;
}

export const router = {
  visit: () => undefined,
  get: () => undefined,
  post: () => undefined,
  put: () => undefined,
  patch: () => undefined,
  delete: () => undefined,
  reload: () => undefined,
  replace: () => undefined,
};

/** Stub for hooks that fetch JSON via Inertia HTTP helpers in playground previews. */
export function useHttp() {
  return {
    submit: async (url?: unknown) => {
      const path = String(url ?? "");
      if (path.includes("recovery")) return [];
      if (path.includes("secret")) return { secretKey: "" };
      return { svg: "", url: "" };
    },
  };
}
