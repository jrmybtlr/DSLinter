import { describe, expect, it } from "vitest";
import {
  flattenViteAlias,
  importerUnderScanRoot,
  resolveWithConsumerAliases,
} from "./consumerAlias";

describe("flattenViteAlias", () => {
  it("resolves @/ prefix from record alias", () => {
    const aliases = flattenViteAlias(
      { "@": "/app/resources/js", "@/": "/app/resources/js/" },
      "/app",
    );
    const resolved = resolveWithConsumerAliases(
      "@/Components/Button",
      aliases,
    );
    expect(resolved?.replace(/\\/g, "/")).toContain("resources/js");
    expect(resolved?.replace(/\\/g, "/")).toContain("Components/Button");
  });
});

describe("importerUnderScanRoot", () => {
  it("matches files under scan root", () => {
    expect(
      importerUnderScanRoot(
        "/repo/resources/js/Components/Foo.tsx",
        "/repo",
      ),
    ).toBe(true);
    expect(
      importerUnderScanRoot(
        "/other/pkg/Button.tsx",
        "/repo",
      ),
    ).toBe(false);
  });

  it("matches paths with Vite query suffixes", () => {
    expect(
      importerUnderScanRoot(
        "/repo/resources/js/hooks/use-current-url.ts?v=abc",
        "/repo",
      ),
    ).toBe(true);
  });
});
