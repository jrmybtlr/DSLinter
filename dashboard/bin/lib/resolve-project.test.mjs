import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveProjectRoot,
  resolveScanAndProjectRoots,
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
});

describe("resolveScanPath", () => {
  it("defaults to cwd when no explicit path", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scan-default-"));
    const sub = join(root, "src", "components");
    mkdirSync(sub, { recursive: true });
    expect(resolveScanPath(null, sub)).toBe(sub);
  });

  it("treats '.' as literal cwd", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scan-dot-"));
    const sub = join(root, "resources", "js", "components");
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(root, "vite.config.js"), "export default {};\n");
    expect(resolveScanPath(".", sub)).toBe(sub);
    expect(resolveScanPath(".", sub)).not.toBe(root);
  });

  it("honors explicit positional path", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scan-explicit-"));
    const demo = join(root, "demo");
    mkdirSync(demo, { recursive: true });
    expect(resolveScanPath("demo", root)).toBe(demo);
  });
});

describe("resolveScanAndProjectRoots", () => {
  it("keeps scan at cwd and project at vite root from subdirectory", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scan-project-"));
    const components = join(root, "resources", "js", "components");
    mkdirSync(components, { recursive: true });
    writeFileSync(join(root, "vite.config.js"), "export default {};\n");

    const result = resolveScanAndProjectRoots(null, components);
    expect(result.scanPath).toBe(components);
    expect(result.projectRoot).toBe(root);
  });

  it("uses cwd for '.' while project root is vite root", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scan-dot-project-"));
    const components = join(root, "resources", "js", "components");
    mkdirSync(components, { recursive: true });
    writeFileSync(join(root, "vite.config.js"), "export default {};\n");

    const result = resolveScanAndProjectRoots(".", components);
    expect(result.scanPath).toBe(components);
    expect(result.projectRoot).toBe(root);
  });
});
