import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  pickReleaseAsset,
} from "../scripts/github-release.mjs";
import {
  CLI_BINARY_NAME,
  DEFAULT_GITHUB_REPO,
  parseGitHubRepo,
  releaseAssetBaseName,
  releaseAssetCandidateNames,
  vendorBinaryPath,
} from "../scripts/resolve-dslint-binary.mjs";

function proc(platform: string, arch: string): NodeJS.Process {
  return { platform, arch } as NodeJS.Process;
}

describe("parseGitHubRepo", () => {
  it("parses https repository url", () => {
    expect(
      parseGitHubRepo("https://github.com/jrmybtlr/DSLinter.git"),
    ).toBe("jrmybtlr/DSLinter");
  });

  it("parses repository object", () => {
    expect(
      parseGitHubRepo({
        type: "git",
        url: "git+https://github.com/jrmybtlr/DSLinter.git",
      }),
    ).toBe("jrmybtlr/DSLinter");
  });

  it("defaults constant points at DSLinter", () => {
    expect(DEFAULT_GITHUB_REPO).toBe("jrmybtlr/DSLinter");
  });
});

describe("releaseAssetCandidateNames", () => {
  it("includes legacy dslint asset name", () => {
    expect(releaseAssetCandidateNames(proc("darwin", "arm64"))).toEqual([
      "dslinter-aarch64-apple-darwin",
      "dslint-aarch64-apple-darwin",
    ]);
  });
});

describe("pickReleaseAsset", () => {
  it("prefers primary name then legacy", () => {
    const release = {
      assets: [
        {
          name: "dslint-aarch64-apple-darwin",
          browser_download_url: "https://example.com/legacy",
        },
      ],
    };
    expect(
      pickReleaseAsset(release, releaseAssetCandidateNames(proc("darwin", "arm64"))),
    ).toMatchObject({ name: "dslint-aarch64-apple-darwin" });
  });
});

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
