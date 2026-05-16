#!/usr/bin/env node
/**
 * Runs the `dslint` scanner: prefers a vendored binary from postinstall, else `dslint` on PATH.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { vendorBinaryPath } from "../scripts/resolve-dslint-binary.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

const args = process.argv.slice(2);

const vendored = vendorBinaryPath(packageRoot);
const cmd = vendored && existsSync(vendored) ? vendored : "dslint";
const child = spawnSync(cmd, args, { stdio: "inherit" });

if (child.error && "code" in child.error && child.error.code === "ENOENT") {
  process.stderr.write(`dslint: command not found.

The dslinter package can download a prebuilt dslint on npm install when a matching
GitHub release exists (same tag as this package version, e.g. v0.0.6). See:
https://github.com/jrmybtlr/DSLint/releases

Otherwise install dslint on PATH:

  cargo install dslint
  # or from this repo:
  cargo install --path .

Skip auto-download (air-gapped): DSLINT_SKIP_DOWNLOAD=1
`);
  process.exit(127);
}

const code = child.status === null ? 1 : child.status;
process.exit(code);
