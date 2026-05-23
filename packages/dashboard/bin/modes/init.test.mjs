import { existsSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runInitMode } from "./init.mjs";

describe("runInitMode", () => {
  it("scaffolds config and playground registry", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-init-"));
    mkdirSync(join(root, "src", "components"), { recursive: true });
    runInitMode({ targetDir: root, argv: [] });

    expect(existsSync(join(root, ".dslinter.json"))).toBe(true);
    expect(existsSync(join(root, "src", "playground", "buildRegistry.ts"))).toBe(true);
  });
});
