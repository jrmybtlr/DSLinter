#!/usr/bin/env node
/**
 * Runs the design-system scanner (`dslinter` binary from GitHub Releases or DSLINT_BIN).
 * Does NOT use bare `dslint` on PATH — that name is a different crate on crates.io.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDslintBinary } from "../scripts/ensure-dslint.mjs";
import {
  SCANNER_VERSION_MARKER,
  vendorBinaryPath,
} from "../scripts/resolve-dslint-binary.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

const args = process.argv.slice(2);

function isOurScanner(binary) {
  const help = spawnSync(binary, ["--help"], { encoding: "utf8" });
  const out = `${help.stdout ?? ""}${help.stderr ?? ""}`;
  return out.includes(SCANNER_VERSION_MARKER);
}

async function resolveCommand() {
  const fromEnv = process.env.DSLINT_BIN?.trim();
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      process.stderr.write(`dslinter: DSLINT_BIN not found: ${fromEnv}\n`);
      process.exit(127);
    }
    if (!isOurScanner(fromEnv)) {
      process.stderr.write(
        `dslinter: DSLINT_BIN does not look like the DSLint design-system scanner.\n` +
          `  Expected output containing "${SCANNER_VERSION_MARKER}".\n`,
      );
      process.exit(1);
    }
    return fromEnv;
  }

  const vendored = vendorBinaryPath(packageRoot);
  if (!existsSync(vendored)) {
    await ensureDslintBinary(packageRoot, { quiet: true });
  }
  if (existsSync(vendored)) {
    return vendored;
  }

  if (process.env.DSLINT_ALLOW_PATH === "1") {
    const onPath = spawnSync("dslinter", ["--version"], { encoding: "utf8" });
    if (onPath.status === 0 && `${onPath.stdout}`.includes(SCANNER_VERSION_MARKER)) {
      return "dslinter";
    }
  }

  await import("../scripts/print-missing-scanner.mjs");
  process.exit(127);
}

const cmd = await resolveCommand();
const child = spawnSync(cmd, args, { stdio: "inherit" });

if (child.error && "code" in child.error && child.error.code === "ENOENT") {
  process.stderr.write(`dslinter: failed to execute ${cmd}\n`);
  process.exit(127);
}

const code = child.status === null ? 1 : child.status;
process.exit(code);
