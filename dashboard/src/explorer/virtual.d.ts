/// <reference types="vite/client" />
declare module "virtual:dslinter/explorer" {
  const context: {
    root: string;
    apps: { id: string; name: string; framework: string }[];
    selectedApp: string;
  };
  export default context;
}
declare module "virtual:dslinter/adapter" {
  const adapter: import("./protocol").PreviewAdapter;
  export default adapter;
}
declare module "virtual:dslinter/framework" {
  export const mount: typeof import("./reactRuntime").mount;
}
