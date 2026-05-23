import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ensureDslintConfig } from "./scaffold-config.mjs";

describe("ensureDslintConfig", () => {
  it("writes starter config with detected include/css paths", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scaffold-"));
    mkdirSync(join(root, "src", "components"), { recursive: true });
    writeFileSync(join(root, "src", "index.css"), "@theme { --color-primary: #000; }");

    const result = ensureDslintConfig({ targetDir: root, layout: "default" });
    expect(result.created).toBe(true);

    const raw = readFileSync(result.path, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.include_dirs).toEqual(["src/components"]);
    expect(parsed.css_entrypoints).toContain("src/index.css");
    expect(parsed.ignore_globs).toEqual([]);
  });

  it("prefers narrowest laravel components dir", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scaffold-laravel-"));
    mkdirSync(join(root, "resources", "js", "components"), { recursive: true });
    mkdirSync(join(root, "resources", "js", "layouts"), { recursive: true });

    const result = ensureDslintConfig({ targetDir: root, layout: "laravel" });
    const parsed = JSON.parse(readFileSync(result.path, "utf8"));
    expect(parsed.include_dirs).toEqual(["resources/js/components"]);
  });

  it("does not overwrite an existing config", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scaffold-existing-"));
    const existing = join(root, ".dslinter.json");
    writeFileSync(existing, "{\n  \"ignore_globs\": [\"custom/**\"]\n}\n");

    const result = ensureDslintConfig({ targetDir: root, layout: "default" });
    expect(result.created).toBe(false);
    expect(result.path).toBe(existing);
    expect(readFileSync(existing, "utf8")).toContain("custom/**");
  });
});
