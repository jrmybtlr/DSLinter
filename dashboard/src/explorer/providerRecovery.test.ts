import { describe, expect, it, vi } from "vitest";
import type { CatalogComponent, ProviderCandidate } from "../types/report";
import {
  contextRequirement,
  contextAdapterExample,
  recoverProviders,
  wrapProviders,
  PreviewContextError,
} from "./providerRecovery";
import { demoSnippet } from "./recipes";

const component: CatalogComponent = {
  id: "src/Brand.tsx#Brand",
  name: "Brand",
  framework: "react",
  preview: { id: "Brand", rel_path: "src/Brand.tsx", export_name: "Brand", declared_props: [] },
  bindings: {},
  dependencies: [],
  usages: [],
};
function provider(name = "SidebarProvider", prefix = "src"): ProviderCandidate {
  return {
    id: `${prefix}/context.tsx#${name}`,
    name,
    rel_path: `${prefix}/context.tsx`,
    export_name: name,
  };
}
function options(attempt: (providers: ProviderCandidate[]) => Promise<unknown>) {
  return {
    component,
    candidates: [provider()],
    initial: [],
    authoritative: false,
    current: () => true,
    onFailure: vi.fn(),
    attempt,
  };
}
const missing = () => new Error("useSidebar must be used within a SidebarProvider.");

describe("provider recovery", () => {
  it("recognizes React, Vue/Reka ancestor alternatives, and bare injection warnings", () => {
    expect(contextRequirement(missing())?.names).toEqual(["SidebarProvider"]);
    expect(
      contextRequirement(
        new Error(
          "Injection `Symbol(Menu)` not found. Component must be used within one of the following components: MenuRoot, MenuSub",
        ),
      )?.names,
    ).toEqual(["MenuRoot", "MenuSub"]);
    expect(contextRequirement('injection "service" not found.')?.names).toEqual([]);
    expect(contextRequirement(new Error("Cannot read properties of undefined"))).toBeUndefined();
  });
  it("retries the same preview with the verified provider and reuses a cached chain", async () => {
    const attempt = vi.fn(async (providers: ProviderCandidate[]) => {
      if (!providers.length) throw missing();
      return "rendered";
    });
    const result = await recoverProviders(options(attempt));
    expect(result?.providers).toEqual([provider()]);
    expect(attempt).toHaveBeenCalledTimes(2);
    attempt.mockClear();
    await recoverProviders({ ...options(attempt), initial: result!.providers });
    expect(attempt).toHaveBeenCalledTimes(1);
  });
  it.each(["ambiguous", "absent", "configured", "injection", "repeat"])(
    "stops with useful diagnostics for %s",
    async (kind) => {
      const config = options(async () => {
        throw kind === "injection" ? new Error('injection "service" not found.') : missing();
      });
      if (kind === "ambiguous") config.candidates.push(provider("SidebarProvider", "other"));
      if (kind === "absent") config.candidates = [];
      if (kind === "configured") config.authoritative = true;
      await expect(recoverProviders(config)).rejects.toBeInstanceOf(PreviewContextError);
      expect(config.onFailure).toHaveBeenCalledTimes(kind === "repeat" ? 2 : 1);
    },
  );
  it("wraps nested providers in dependency order, supplies fixtures, and includes them in snippets", async () => {
    const inner = provider("InnerProvider"),
      outer = provider("OuterProvider");
    const result = await recoverProviders({
      ...options(async (providers) => {
        if (!providers.length) throw new Error("Child must be used within InnerProvider");
        if (providers.length === 1)
          throw new Error("InnerProvider must be used within OuterProvider");
        return true;
      }),
      candidates: [inner, outer],
    });
    const tree = wrapProviders({ name: "Brand" }, result!.providers, {
      [outer.id]: { open: true },
    });
    expect(demoSnippet(tree, "react")).toBe(
      "<OuterProvider open={true}>\n  <InnerProvider>\n    <Brand />\n  </InnerProvider>\n</OuterProvider>",
    );
  });
  it("bounds recovery, stops unrelated provider failures, and cancels stale work", async () => {
    const candidates = Array.from({ length: 5 }, (_, index) => provider(`Provider${index}`));
    await expect(
      recoverProviders({
        ...options(async (providers) => {
          throw new Error(`Child must be used within Provider${providers.length}`);
        }),
        candidates,
      }),
    ).rejects.toMatchObject({ diagnostic: { reason: expect.stringContaining("four") } });
    const failure = new Error("Provider needs account data");
    await expect(
      recoverProviders(
        options(async (providers) => {
          if (providers.length) throw failure;
          throw missing();
        }),
      ),
    ).rejects.toMatchObject({ diagnostic: { reason: expect.stringContaining(failure.message) } });
    let current = true;
    const attempt = vi.fn(async () => {
      current = false;
      throw missing();
    });
    expect(await recoverProviders({ ...options(attempt), current: () => current })).toBeUndefined();
    expect(attempt).toHaveBeenCalledTimes(1);
  });
  it("does not add providers already present in the source example", async () => {
    const config = {
      ...options(async () => {
        throw missing();
      }),
      present: [provider().id],
    };
    await expect(recoverProviders(config)).rejects.toMatchObject({
      diagnostic: { reason: expect.stringContaining("already present") },
    });
    expect(config.onFailure).toHaveBeenCalledTimes(1);
  });
  it("matches source-backed primitive aliases", async () => {
    const result = await recoverProviders({
      ...options(async (providers) => {
        if (!providers.length) throw new Error("Component must be used within `SelectRoot`");
        return true;
      }),
      candidates: [{ ...provider("Select"), aliases: ["SelectRoot"] }],
    });
    expect(result?.providers[0].name).toBe("Select");
  });
  it("generates adapter imports relative to the actual adapter and forwards values", () => {
    const example = contextAdapterExample(component, [provider()], "/workspace/app", "/workspace");
    expect(example).toContain('from "../src/context.tsx"');
    expect(example).toContain("<PreviewProvider1><PreviewTarget {...values} /></PreviewProvider1>");
    const vue = contextAdapterExample(
      { ...component, framework: "vue" },
      [provider()],
      "/workspace",
      "/workspace",
    );
    expect(vue).toContain("h(PreviewProvider1, {}, { default: () => h(PreviewTarget, values) })");
    expect(vue).toContain("const values = attrs");
  });
});
