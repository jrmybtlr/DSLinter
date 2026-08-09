import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { describe, expect, it } from "vitest";
import { loadConsumerAliases } from "./loadConsumerAliases";
import { collectScanModuleRelPaths } from "./collectScanModules";
import { resolveExistingModule } from "./resolveWayfinderImport";
import dslinter from "./plugin";

const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const demoInertiaRoot = resolve(packageRoot, "../demo/inertia");
const navFooter = join(demoInertiaRoot, "resources/js/components/nav-footer.tsx");

describe("dslinter vite plugin resolveId", () => {
  it("has scan paths and consumer aliases for demo/inertia", () => {
    const relPaths = collectScanModuleRelPaths(demoInertiaRoot);
    expect(relPaths).toContain("resources/js/components/nav-footer.tsx");
    const aliases = loadConsumerAliases(demoInertiaRoot, undefined);
    const file = resolveExistingModule("@/components/ui/sidebar", aliases);
    expect(file?.replace(/\\/g, "/")).toContain(
      "demo/inertia/resources/js/components/ui/sidebar.tsx",
    );
  });

  it("resolveId hook returns consumer file for playground importer", async () => {
    const plugin = dslinter({
      scanRoot: demoInertiaRoot,
      consumerViteRoot: demoInertiaRoot,
    });
    const resolved = await plugin.resolveId?.("@/components/ui/sidebar", navFooter, { ssr: false });
    expect(resolved?.replace(/\\/g, "/")).toContain(
      "demo/inertia/resources/js/components/ui/sidebar.tsx",
    );
  });

  it("resolves @/ imports via pluginContainer", async () => {
    const server = await createServer({
      root: packageRoot,
      plugins: [
        dslinter({
          scanRoot: demoInertiaRoot,
          consumerViteRoot: demoInertiaRoot,
        }),
      ],
      server: { fs: { allow: [packageRoot, demoInertiaRoot] } },
    });

    try {
      const resolved = await server.pluginContainer.resolveId("@/components/ui/sidebar", navFooter);
      expect(resolved?.id.replace(/\\/g, "/")).toContain(
        "demo/inertia/resources/js/components/ui/sidebar",
      );
      expect(existsSync(resolved!.id.split("?")[0]!)).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("injects consumer @source into embed/index.css via load (before Tailwind)", async () => {
    const embedCss = join(packageRoot, "embed/index.css");
    const server = await createServer({
      configFile: false,
      root: packageRoot,
      plugins: [
        dslinter({
          scanRoot: demoInertiaRoot,
          consumerViteRoot: demoInertiaRoot,
        }),
      ],
      server: { fs: { allow: [packageRoot, demoInertiaRoot] } },
    });

    try {
      const loaded = await server.pluginContainer.load(embedCss);
      const code = typeof loaded === "string" ? loaded : loaded && "code" in loaded ? loaded.code : null;
      expect(code).toContain('@source "../src"');
      expect(code).toMatch(/demo\/inertia\/resources\/js\/components/);
    } finally {
      await server.close();
    }
  });
});
