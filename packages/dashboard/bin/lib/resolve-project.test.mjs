import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  promoteScanToProjectRoot,
  resolveProjectRoot,
  resolveScanPath,
} from "./resolve-project.mjs";

describe("resolveProjectRoot", () => {
  it("prefers vite root over laravel layout when both exist", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-resolve-vite-"));
    mkdirSync(join(root, "resources", "js"), { recursive: true });
    writeFileSync(join(root, "vite.config.js"), "export default {};\n");
    expect(resolveProjectRoot(root)).toBe(root);
  });

  it("uses resources/js ancestor when no vite config", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-resolve-laravel-"));
    mkdirSync(join(root, "resources", "js", "Components"), { recursive: true });
    const sub = join(root, "resources", "js", "Components");
    expect(resolveProjectRoot(sub)).toBe(root);
  });

  it("promotes implicit cwd subdirectory scan to project root", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-promote-"));
    const components = join(root, "resources", "js", "Components");
    mkdirSync(components, { recursive: true });
    writeFileSync(join(root, "vite.config.js"), "export default {};\n");
    const result = promoteScanToProjectRoot(components, components);
    expect(result.promoted).toBe(true);
    expect(result.scanPath).toBe(root);
  });

  it("does not promote when explicit scan path differs from project root", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-explicit-subdir-"));
    const components = join(root, "resources", "js", "components");
    mkdirSync(components, { recursive: true });
    writeFileSync(join(root, "vite.config.js"), "export default {};\n");
    const explicit = resolveScanPath("resources/js/components", root);
    expect(explicit).toBe(components);
    const result = promoteScanToProjectRoot(explicit, root);
    expect(result.promoted).toBe(true);
    expect(result.scanPath).toBe(root);
  });
});

describe("resolveScanPath", () => {
  it("defaults to project root when no explicit path", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scan-default-"));
    writeFileSync(join(root, "vite.config.ts"), "export default {};\n");
    expect(resolveScanPath(null, root)).toBe(root);
  });

  it("honors explicit positional path", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scan-explicit-"));
    const demo = join(root, "demo");
    mkdirSync(demo, { recursive: true });
    expect(resolveScanPath("demo", root)).toBe(demo);
  });
});
