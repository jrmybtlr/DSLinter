import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  expandEditorOpenCommand,
  isPathUnderRoot,
  resolveEditorOpenArgv,
} from "./openFileInEditor.mjs";

describe("expandEditorOpenCommand", () => {
  it("replaces file, line, and column placeholders", () => {
    expect(
      expandEditorOpenCommand("cursor --goto {file}:{line}:{column}", {
        file: "/repo/Button.tsx",
        line: 4,
        column: 2,
      }),
    ).toEqual(["cursor", "--goto", "/repo/Button.tsx:4:2"]);
  });

  it("supports quoted paths with spaces", () => {
    expect(
      expandEditorOpenCommand('code -g "{file}:{line}:{column}"', {
        file: "/repo/My Button.tsx",
        line: 1,
        column: 1,
      }),
    ).toEqual(["code", "-g", "/repo/My Button.tsx:1:1"]);
  });
});

describe("isPathUnderRoot", () => {
  it("accepts files under the scan root", () => {
    expect(
      isPathUnderRoot("/repo/src/Button.tsx", "/repo"),
    ).toBe(true);
  });

  it("rejects paths outside the scan root", () => {
    expect(
      isPathUnderRoot("/etc/passwd", "/repo"),
    ).toBe(false);
  });
});

describe("resolveEditorOpenArgv", () => {
  const ctx = {
    file: "/repo/src/Button.tsx",
    line: 10,
    column: 1,
  };

  it("uses configured command when provided", () => {
    expect(
      resolveEditorOpenArgv(
        ctx,
        "my-editor --jump {file}:{line}:{column}",
      ),
    ).toEqual(["my-editor", "--jump", "/repo/src/Button.tsx:10:1"]);
  });
});

describe("loadEditorOpenCommand", () => {
  let tempDir = "";

  afterEach(() => {
    tempDir = "";
  });

  it("reads editor_open_command from .dslinter.json", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "dslinter-open-"));
    writeFileSync(
      join(tempDir, ".dslinter.json"),
      JSON.stringify({ editor_open_command: "zed {file}:{line}" }),
    );
    const previous = process.env.DSLINTER_EDITOR;
    delete process.env.DSLINTER_EDITOR;
    try {
      const { loadEditorOpenCommand } = await import("./openFileInEditor.mjs");
      expect(loadEditorOpenCommand(tempDir)).toBe("zed {file}:{line}");
    } finally {
      if (previous === undefined) delete process.env.DSLINTER_EDITOR;
      else process.env.DSLINTER_EDITOR = previous;
    }
  });
});
