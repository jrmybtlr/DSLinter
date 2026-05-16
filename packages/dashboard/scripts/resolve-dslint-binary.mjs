import { join } from "node:path";

/** CLI binary name (avoids collision with unrelated `dslint` on crates.io). */
export const CLI_BINARY_NAME = "dslinter";

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
