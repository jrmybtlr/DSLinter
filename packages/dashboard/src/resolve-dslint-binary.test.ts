import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLI_BINARY_NAME,
  releaseAssetBaseName,
  vendorBinaryPath,
} from "../scripts/resolve-dslint-binary.mjs";

function proc(platform: string, arch: string): NodeJS.Process {
  return { platform, arch } as NodeJS.Process;
}

describe("releaseAssetBaseName", () => {
  it("maps darwin arm64", () => {
    expect(releaseAssetBaseName(proc("darwin", "arm64"))).toBe(
      "dslinter-aarch64-apple-darwin",
    );
  });

  it("maps linux x64", () => {
    expect(releaseAssetBaseName(proc("linux", "x64"))).toBe(
      "dslinter-x86_64-unknown-linux-gnu",
    );
  });

  it("maps win32 x64", () => {
    expect(releaseAssetBaseName(proc("win32", "x64"))).toBe(
      "dslinter-x86_64-pc-windows-msvc.exe",
    );
  });

  it("returns null for unknown", () => {
    expect(releaseAssetBaseName(proc("freebsd", "x64"))).toBeNull();
  });
});

describe("vendorBinaryPath", () => {
  it("uses dslinter.exe on Windows", () => {
    expect(vendorBinaryPath(join("/", "pkg"), proc("win32", "x64"))).toBe(
      join("/", "pkg", "vendor", `${CLI_BINARY_NAME}.exe`),
    );
  });

  it("uses dslinter on Unix", () => {
    expect(vendorBinaryPath(join("/", "pkg"), proc("linux", "x64"))).toBe(
      join("/", "pkg", "vendor", CLI_BINARY_NAME),
    );
  });
});
