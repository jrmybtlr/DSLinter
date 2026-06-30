import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hideComponentInDslintConfig } from "./config-hide-component.mjs";

describe("hideComponentInDslintConfig", () => {
  const dirs = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("appends hidden_components to a new config file", () => {
    const root = mkdtempSync(join(tmpdir(), "dslint-hide-"));
    dirs.push(root);
    const result = hideComponentInDslintConfig(root, "Foo");
    expect(result.hidden_components).toEqual(["Foo"]);
    const written = JSON.parse(
      readFileSync(join(root, ".dslinter.json"), "utf8"),
    );
    expect(written.hidden_components).toEqual(["Foo"]);
  });

  it("does not duplicate names", () => {
    const root = mkdtempSync(join(tmpdir(), "dslint-hide-"));
    dirs.push(root);
    hideComponentInDslintConfig(root, "Foo");
    const result = hideComponentInDslintConfig(root, "Foo");
    expect(result.hidden_components).toEqual(["Foo"]);
  });
});
