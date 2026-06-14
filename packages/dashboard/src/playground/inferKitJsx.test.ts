import { describe, expect, it } from "vitest";
import {
  inferKitJsxSlots,
  inferKitRootPropBindings,
  slotDefaultFromComponent,
  slotLabelFromComponent,
} from "./inferKitJsx";

describe("inferKitJsx", () => {
  it("reads createElement children bindings (including vite transforms)", () => {
    const viteTransformed =
      "({ title, description }) => (0,createElement)(Alert, { variant: 'default' }, (0,createElement)(AlertTitle, null, title), (0,createElement)(AlertDescription, null, description))";
    const fromVite = Object.assign(() => null, { toString: () => viteTransformed });
    expect(inferKitJsxSlots(fromVite)).toEqual([
      { component: "AlertTitle", param: "title" },
      { component: "AlertDescription", param: "description" },
    ]);
  });

  it("reads root prop bindings from createElement", () => {
    const fromVite = Object.assign(() => null, {
      toString: () => "({ variant }) => (0,createElement)(Alert, { variant }, (0,createElement)(AlertTitle, null, 'Hi'))",
    });
    expect(inferKitRootPropBindings(fromVite)).toEqual([
      { component: "Alert", prop: "variant", param: "variant" },
    ]);
  });

  it("reads root prop bindings from vite SSR import wrappers", () => {
    const fromVite = Object.assign(() => null, {
      toString: () =>
        "({ title, description, variant }) => (0,__vite_ssr_import_0__.createElement)(\n      Alert,\n      { variant },\n      (0,__vite_ssr_import_0__.createElement)(AlertTitle, null, title),\n      (0,__vite_ssr_import_0__.createElement)(AlertDescription, null, description)\n    )",
    });
    expect(inferKitRootPropBindings(fromVite)).toEqual([
      { component: "Alert", prop: "variant", param: "variant" },
    ]);
  });

  it("reads root prop bindings from source JSX", () => {
    const kit = Object.assign(() => null, {
      toString: () =>
        '({ title, description, variant }) => (<Alert className="max-w-md" variant={variant}><AlertTitle>{title}</AlertTitle></Alert>)',
    });
    expect(inferKitRootPropBindings(kit)).toEqual([
      { component: "Alert", prop: "variant", param: "variant" },
    ]);
  });

  it("reads source JSX slots", () => {
    const kit = Object.assign(() => null, {
      toString: () =>
        "({ title, description }) => (<Alert><AlertTitle>{title}</AlertTitle><AlertDescription>{description}</AlertDescription></Alert>)",
    });
    expect(inferKitJsxSlots(kit)).toEqual([
      { component: "AlertTitle", param: "title" },
      { component: "AlertDescription", param: "description" },
    ]);
  });

  it("derives slot labels and defaults from component names", () => {
    expect(slotLabelFromComponent("AlertTitle")).toBe("Title");
    expect(slotLabelFromComponent("AlertDescription")).toBe("Description");
    expect(slotDefaultFromComponent("AlertTitle")).toBe("Heads up");
    expect(slotDefaultFromComponent("DialogTrigger")).toBe("Open");
  });
});
