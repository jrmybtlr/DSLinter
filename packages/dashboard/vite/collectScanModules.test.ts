import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  collectScanModuleRelPaths,
  embedGlobKeyFromRelPath,
} from "./collectScanModules";

describe("embedGlobKeyFromRelPath", () => {
  it("maps Laravel rel_path to @dslinter-scan key", () => {
    expect(
      embedGlobKeyFromRelPath(
        "resources/js/Components/Billing/AdditionalEventLimitModal.tsx",
      ),
    ).toBe(
      "@dslinter-scan/resources/js/Components/Billing/AdditionalEventLimitModal.tsx",
    );
  });

  it("strips leading slashes", () => {
    expect(embedGlobKeyFromRelPath("/src/components/Foo.tsx")).toBe(
      "@dslinter-scan/src/components/Foo.tsx",
    );
  });
});

const caseInsensitiveFs =
  process.platform === "darwin" || process.platform === "win32";

describe("collectScanModuleRelPaths", () => {
  it("collects tsx/jsx and skips node_modules", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scan-"));
    mkdirSync(join(root, "resources", "js", "Components"), { recursive: true });
    writeFileSync(
      join(root, "resources", "js", "Components", "Button.tsx"),
      "export function Button() { return null; }",
    );
    mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(root, "node_modules", "pkg", "Ignored.tsx"), "");

    const paths = collectScanModuleRelPaths(root);
    expect(paths).toEqual(["resources/js/Components/Button.tsx"]);
  });

  it("respects .dslinter.json include_dirs", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scan-inc-"));
    mkdirSync(join(root, "resources", "js", "components", "ui"), {
      recursive: true,
    });
    mkdirSync(join(root, "resources", "js", "pages"), { recursive: true });
    writeFileSync(
      join(root, "resources", "js", "components", "ui", "button.tsx"),
      "export function Button() { return null; }",
    );
    writeFileSync(
      join(root, "resources", "js", "pages", "Home.tsx"),
      "export default function Home() { return null; }",
    );
    writeFileSync(
      join(root, ".dslinter.json"),
      JSON.stringify({ include_dirs: ["resources/js/components"] }),
    );

    const paths = collectScanModuleRelPaths(root);
    expect(paths).toEqual(["resources/js/components/ui/button.tsx"]);
  });

  it.skipIf(!caseInsensitiveFs)(
    "matches include_dirs case-insensitively on case-insensitive filesystems",
    () => {
      const root = mkdtempSync(join(tmpdir(), "dslinter-scan-case-"));
      mkdirSync(join(root, "resources", "js", "Components"), { recursive: true });
      writeFileSync(
        join(root, "resources", "js", "Components", "Button.tsx"),
        "export function Button() { return null; }",
      );
      writeFileSync(
        join(root, ".dslinter.json"),
        JSON.stringify({ include_dirs: ["resources/js/components"] }),
      );

      const paths = collectScanModuleRelPaths(root);
      expect(paths).toEqual(["resources/js/Components/Button.tsx"]);
    },
  );

  it.skipIf(caseInsensitiveFs)(
    "requires include_dirs casing to match on case-sensitive filesystems",
    () => {
      const root = mkdtempSync(join(tmpdir(), "dslinter-scan-case-"));
      mkdirSync(join(root, "resources", "js", "Components"), { recursive: true });
      writeFileSync(
        join(root, "resources", "js", "Components", "Button.tsx"),
        "export function Button() { return null; }",
      );
      writeFileSync(
        join(root, ".dslinter.json"),
        JSON.stringify({ include_dirs: ["resources/js/components"] }),
      );

      expect(collectScanModuleRelPaths(root)).toEqual([]);
    },
  );

  it("scopes collection to scanRoot subdirectory", () => {
    const root = mkdtempSync(join(tmpdir(), "dslinter-scan-sub-"));
    mkdirSync(join(root, "resources", "js", "components"), { recursive: true });
    mkdirSync(join(root, "resources", "js", "layouts", "auth"), {
      recursive: true,
    });
    writeFileSync(
      join(root, "resources", "js", "components", "Button.tsx"),
      "export function Button() { return null; }",
    );
    writeFileSync(
      join(root, "resources", "js", "layouts", "auth", "Split.tsx"),
      "export function Split() { return null; }",
    );
    writeFileSync(
      join(root, ".dslinter.json"),
      JSON.stringify({ include_dirs: ["resources/js"] }),
    );

    const paths = collectScanModuleRelPaths(
      join(root, "resources", "js", "components"),
    );
    expect(paths).toEqual(["resources/js/components/Button.tsx"]);
  });
});
