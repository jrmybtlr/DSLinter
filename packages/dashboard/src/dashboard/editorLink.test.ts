import { describe, expect, it } from "vitest";
import {
  buildEditorFileUri,
  resolveModuleAbsolutePath,
} from "./editorLink";

describe("resolveModuleAbsolutePath", () => {
  it("resolves embed scan keys under report root", () => {
    expect(
      resolveModuleAbsolutePath(
        "/Users/dev/demo-inertia",
        "@dslinter-scan/resources/js/components/app-logo-icon.tsx",
      ),
    ).toBe(
      "/Users/dev/demo-inertia/resources/js/components/app-logo-icon.tsx",
    );
  });

  it("resolves consumer glob keys via src/components convention", () => {
    expect(
      resolveModuleAbsolutePath(
        "/repo",
        "../components/ui/button.tsx",
      ),
    ).toBe("/repo/src/components/ui/button.tsx");
  });
});

describe("buildEditorFileUri", () => {
  it("builds a vscode URI for unix paths", () => {
    expect(
      buildEditorFileUri(
        "/Users/dev/demo-inertia/resources/js/components/app-logo-icon.tsx",
      ),
    ).toBe(
      "vscode://file/Users/dev/demo-inertia/resources/js/components/app-logo-icon.tsx",
    );
  });

  it("supports cursor scheme", () => {
    expect(
      buildEditorFileUri("/repo/src/Button.tsx", 2, 1, "cursor"),
    ).toBe("cursor://file/repo/src/Button.tsx:2:1");
  });

  it("includes line and column when provided", () => {
    expect(
      buildEditorFileUri("/repo/src/Button.tsx", 14),
    ).toBe("vscode://file/repo/src/Button.tsx:14:1");
  });

  it("builds a vscode URI for windows paths", () => {
    expect(
      buildEditorFileUri("C:/project/src/Button.tsx", 3),
    ).toBe("vscode://file/c:/project/src/Button.tsx:3:1");
  });
});
