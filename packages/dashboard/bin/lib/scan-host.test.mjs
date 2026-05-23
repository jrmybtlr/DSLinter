import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  scanProjectHostsDashboard,
  shouldUseConsumerViteDev,
} from "./scan-host.mjs";

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
});
