import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildEmbedIndexCss,
  embedSourcePathsRelativeToCss,
  resolveEmbedConsumerSourceDirs,
  shouldInjectEmbedConsumerSources,
} from "./embedTailwindSources";

const packageRoot = resolve(import.meta.dirname, "..");
const embedCssPath = join(packageRoot, "embed", "index.css");

describe("embedTailwindSources", () => {
  it("maps Laravel include_dirs to paths relative to embed/index.css", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-embed-src-"));
    mkdirSync(join(root, "resources", "js", "components"), { recursive: true });
    writeFileSync(
      join(root, ".dslinter.json"),
      JSON.stringify({ include_dirs: ["resources/js/components"] }),
    );

    const paths = embedSourcePathsRelativeToCss(root, packageRoot, embedCssPath);
    expect(paths.length).toBe(1);
    expect(paths[0]).toMatch(/resources\/js\/components$/);
    expect(resolve(join(packageRoot, "embed"), paths[0]!)).toBe(
      join(root, "resources", "js", "components"),
    );
  });

  it("falls back to src when include_dirs is absent", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-embed-fallback-"));
    mkdirSync(join(root, "src", "components"), { recursive: true });

    const absDirs = resolveEmbedConsumerSourceDirs(root, packageRoot);
    expect(absDirs).toEqual([join(root, "src")]);
  });

  it("skips include_dirs that do not exist on disk", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-embed-missing-"));
    writeFileSync(
      join(root, ".dslinter.json"),
      JSON.stringify({ include_dirs: ["resources/js/components"] }),
    );

    expect(resolveEmbedConsumerSourceDirs(root, packageRoot)).toEqual([]);
  });

  it("buildEmbedIndexCss splices consumer @source after dashboard src", () => {
    const base = `@import "tailwindcss";\n@source "../src";\n@import "../src/styles/dashboard-theme.css";\n`;
    const out = buildEmbedIndexCss(base, ["../../demo/react/src/components"]);
    expect(out).toContain('@source "../src";');
    expect(out).toContain('@source "../../demo/react/src/components";');
    expect(out.indexOf('../src";')).toBeLessThan(
      out.indexOf("demo/react/src/components"),
    );
  });

  it("shouldInjectEmbedConsumerSources when scan root differs from package root", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-embed-inject-"));
    mkdirSync(join(root, "resources", "js", "components"), { recursive: true });
    writeFileSync(
      join(root, ".dslinter.json"),
      JSON.stringify({ include_dirs: ["resources/js/components"] }),
    );

    expect(shouldInjectEmbedConsumerSources(root, packageRoot)).toBe(true);
    expect(shouldInjectEmbedConsumerSources(packageRoot, packageRoot)).toBe(
      false,
    );
  });
});
