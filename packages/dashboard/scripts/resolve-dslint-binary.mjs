import { readFileSync } from "node:fs";
import { join } from "node:path";

/** CLI binary name (avoids collision with unrelated `dslint` on crates.io). */
export const CLI_BINARY_NAME = "dslinter";

/** Fallback when package.json has no parseable `repository` field. */
export const DEFAULT_GITHUB_REPO = "jrmybtlr/DSLinter";

/**
 * @param {string | { type?: string; url?: string } | undefined} repository
 * @returns {string | null} `owner/repo`
 */
export function parseGitHubRepo(repository) {
  if (!repository) return null;
  const url = typeof repository === "string" ? repository : repository.url;
  if (!url) return null;
  const m = String(url).match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * @param {string} packageRoot
 */
export function githubRepoFromPackage(packageRoot) {
  try {
    const pkg = JSON.parse(
      readFileSync(join(packageRoot, "package.json"), "utf8"),
    );
    return parseGitHubRepo(pkg.repository) ?? DEFAULT_GITHUB_REPO;
  } catch {
    return DEFAULT_GITHUB_REPO;
  }
}

/**
 * Maps the current OS/arch to the GitHub release asset basename (must match CI upload names).
 * @param {NodeJS.Process} [proc]
 * @returns {string | null}
 */
export function releaseAssetBaseName(proc = process) {
  const { platform, arch } = proc;
  if (platform === "darwin" && arch === "arm64") {
    return "dslinter-aarch64-apple-darwin";
  }
  if (platform === "darwin" && arch === "x64") {
    return "dslinter-x86_64-apple-darwin";
  }
  if (platform === "linux" && arch === "x64") {
    return "dslinter-x86_64-unknown-linux-gnu";
  }
  if (platform === "linux" && arch === "arm64") {
    return "dslinter-aarch64-unknown-linux-gnu";
  }
  if (platform === "win32" && arch === "x64") {
    return "dslinter-x86_64-pc-windows-msvc.exe";
  }
  return null;
}

/** Primary GitHub asset name plus legacy `dslint-*` names from older releases. */
export function releaseAssetCandidateNames(proc = process) {
  const primary = releaseAssetBaseName(proc);
  if (!primary) return [];
  const legacy = primary.replace(/^dslinter/, "dslint");
  return legacy === primary ? [primary] : [primary, legacy];
}

/**
 * @param {string} packageRoot — directory containing package.json
 * @param {NodeJS.Process} [proc]
 */
export function vendorBinaryPath(packageRoot, proc = process) {
  const name =
    proc.platform === "win32" ? `${CLI_BINARY_NAME}.exe` : CLI_BINARY_NAME;
  return join(packageRoot, "vendor", name);
}

/** Our scanner prints this in `dslinter --version` help output (clap about line). */
export const SCANNER_VERSION_MARKER = "design system linting";
