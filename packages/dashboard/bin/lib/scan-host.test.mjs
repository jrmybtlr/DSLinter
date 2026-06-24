import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  scanProjectHostsDashboard,
  shouldUseConsumerViteDev,
} from "./scan-host.mjs";
import { canRunEmbedVite, embedServeConfigPath } from "./project-root.mjs";

describe("scanProjectHostsDashboard", () => {
  it("detects DashboardLayout in src/App.tsx", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-host-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(
      join(root, "src", "App.tsx"),
      `import { DashboardLayout } from "dslinter";\nexport default function App() { return <DashboardLayout />; }\n`,
    );
    expect(scanProjectHostsDashboard(root)).toBe(true);
  });

  it("returns false for laravel app entry", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-laravel-app-"));
    mkdirSync(join(root, "resources", "js"), { recursive: true });
    writeFileSync(
      join(root, "resources", "js", "app.tsx"),
      `import { createInertiaApp } from "@inertiajs/react";\n`,
    );
    expect(scanProjectHostsDashboard(root)).toBe(false);
  });
});

describe("shouldUseConsumerViteDev", () => {
  it("prefers embed for laravel layout", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-laravel-vite-"));
    mkdirSync(join(root, "resources", "js"), { recursive: true });
    const prev = process.env.DSLINTER_USE_CONSUMER_VITE;
    delete process.env.DSLINTER_USE_CONSUMER_VITE;
    expect(shouldUseConsumerViteDev(root)).toBe(false);
    process.env.DSLINTER_USE_CONSUMER_VITE = prev;
  });

  it("uses embed vite on published npm layout when embed sources ship", () => {
    const laravelRoot = mkdtempSync(join(tmpdir(), "dslinter-laravel-npm-"));
    mkdirSync(join(laravelRoot, "resources", "js"), { recursive: true });
    writeFileSync(join(laravelRoot, "vite.config.js"), "export default {};\n");

    const dslinterPkg = mkdtempSync(join(tmpdir(), "dslinter-pkg-"));
    mkdirSync(join(dslinterPkg, "embed"), { recursive: true });
    writeFileSync(join(dslinterPkg, "embed", "main.tsx"), "export {};\n");
    mkdirSync(join(dslinterPkg, "vite"), { recursive: true });
    writeFileSync(
      join(dslinterPkg, "vite", "embed-serve.config.ts"),
      "export default {};\n",
    );

    expect(shouldUseConsumerViteDev(laravelRoot)).toBe(false);
    expect(canRunEmbedVite(dslinterPkg)).toBe(true);
    expect(embedServeConfigPath(dslinterPkg)).not.toBeNull();
  });
});
