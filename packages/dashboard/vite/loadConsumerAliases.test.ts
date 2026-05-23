import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  flattenTsconfigPaths,
  loadConsumerAliases,
  stripJsonComments,
} from "./loadConsumerAliases";
import { resolveWithConsumerAliases } from "./consumerAlias";
import {
  isWayfinderActionsImport,
  isWayfinderRoutesImport,
  resolveExistingModule,
  resolveWayfinderShim,
} from "./resolveWayfinderImport";

describe("stripJsonComments", () => {
  it("removes line and block comments outside strings", () => {
    const input = `{
      // line comment
      "compilerOptions": {
        /* block */
        "paths": { "@/*": ["./resources/js/*"] }
      }
    }`;
    const stripped = stripJsonComments(input);
    expect(JSON.parse(stripped)).toEqual({
      compilerOptions: {
        paths: { "@/*": ["./resources/js/*"] },
      },
    });
  });
});

describe("flattenTsconfigPaths", () => {
  it("maps @/* to resources/js", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-tsconfig-"));
    const aliases = flattenTsconfigPaths(
      { "@/*": ["./resources/js/*"] },
      root,
    );
    const resolved = resolveWithConsumerAliases(
      "@/components/ui/sidebar",
      aliases,
    );
    expect(resolved?.replace(/\\/g, "/")).toContain("resources/js/components/ui/sidebar");
  });
});

describe("loadConsumerAliases", () => {
  it("reads @/* from tsconfig.json when vite alias is empty", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-load-alias-"));
    mkdirSync(join(root, "resources", "js", "components", "ui"), {
      recursive: true,
    });
    writeFileSync(
      join(root, "resources", "js", "components", "ui", "sidebar.tsx"),
      "export {}",
    );
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@/*": ["./resources/js/*"] },
        },
      }),
    );

    const aliases = loadConsumerAliases(root, undefined);
    const resolved = resolveExistingModule(
      "@/components/ui/sidebar",
      aliases,
    );
    expect(resolved?.replace(/\\/g, "/")).toContain(
      "resources/js/components/ui/sidebar.tsx",
    );
  });

  it("falls back to resources/js when no tsconfig", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-laravel-fallback-"));
    mkdirSync(join(root, "resources", "js", "lib"), { recursive: true });
    writeFileSync(join(root, "resources", "js", "lib", "utils.ts"), "export {}");

    const aliases = loadConsumerAliases(root, undefined);
    const resolved = resolveExistingModule("@/lib/utils", aliases);
    expect(resolved?.replace(/\\/g, "/")).toContain("resources/js/lib/utils.ts");
  });
});

describe("resolveWayfinderImport", () => {
  it("detects routes and actions prefixes", () => {
    expect(isWayfinderRoutesImport("@/routes")).toBe(true);
    expect(isWayfinderRoutesImport("@/routes/two-factor")).toBe(true);
    expect(isWayfinderActionsImport("@/actions/App/Http/Controllers/Foo")).toBe(
      true,
    );
    expect(isWayfinderRoutesImport("@/components/foo")).toBe(false);
  });

  it("returns shim paths when generated files are missing", () => {
    const shim = resolveWayfinderShim(
      "@/routes/two-factor",
      "/shims/wayfinder-routes.ts",
      "/shims/wayfinder-actions.ts",
    );
    expect(shim).toBe("/shims/wayfinder-routes.ts");

    const actionShim = resolveWayfinderShim(
      "@/actions/App/Http/Controllers/Settings/ProfileController",
      "/shims/wayfinder-routes.ts",
      "/shims/wayfinder-actions.ts",
    );
    expect(actionShim).toBe("/shims/wayfinder-actions.ts");
  });

  it("resolves directory imports to index.ts", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-routes-dir-"));
    mkdirSync(join(root, "resources", "js", "routes"), { recursive: true });
    writeFileSync(
      join(root, "resources", "js", "routes", "index.ts"),
      "export const dashboard = () => '/';",
    );
    const aliases = loadConsumerAliases(root, undefined);
    const resolved = resolveExistingModule("@/routes", aliases);
    expect(resolved?.replace(/\\/g, "/")).toContain(
      "resources/js/routes/index.ts",
    );
  });
});
