#!/usr/bin/env node
/**
 * Run DSLint using either:
 *  - a `dslinter` binary on PATH or DSLINT_BIN (preferred)
 *  - `cargo run --bin dslinter` from this repo (Rust development)
 *
 * Does not use crates.io `dslint` (different project).
 *
 * Selection:
 *  - `DSLINT_DEV_FLAVOR=bin|cargo|auto` (default: auto)
 *
 * Extras:
 *  - `--print-cmd` prints the resolved command and exits 0 (useful for CI/dev envs).
 */
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { accessSync, constants as fsConstants } from "node:fs";

const SCANNER_MARKER = "design system linting";

function cmdOk(cmd, args = ["--version"]) {
  return spawnSync(cmd, args, { stdio: "ignore" }).status === 0;
}

function isOurScanner(cmd) {
  const r = spawnSync(cmd, ["--help"], { encoding: "utf8" });
  return `${r.stdout ?? ""}`.includes(SCANNER_MARKER);
}

function findScannerBin() {
  const fromEnv = process.env.DSLINT_BIN?.trim();
  if (fromEnv && cmdOk(fromEnv, ["--help"]) && isOurScanner(fromEnv)) {
    return fromEnv;
  }
  if (cmdOk("dslinter") && isOurScanner("dslinter")) return "dslinter";
  return null;
}

function cargoManifestPath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "..", "..", "Cargo.toml");
}

function manifestExists(manifestPath) {
  try {
    accessSync(manifestPath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

const argv = process.argv.slice(2);
const printCmdIdx = argv.indexOf("--print-cmd");
const shouldPrintCmd = printCmdIdx !== -1;
if (shouldPrintCmd) argv.splice(printCmdIdx, 1);

const flavor =
  (process.env.DSLINT_DEV_FLAVOR ?? "auto").toLowerCase() ?? "auto";

const scannerBin = findScannerBin();
const cargoOk = cmdOk("cargo");
const manifestPath = cargoManifestPath();

/** @type {"bin" | "cargo" | null} */
let resolved = null;

if (flavor === "bin") {
  resolved = scannerBin ? "bin" : null;
} else if (flavor === "cargo") {
  resolved = cargoOk && manifestExists(manifestPath) ? "cargo" : null;
} else {
  resolved = scannerBin
    ? "bin"
    : cargoOk && manifestExists(manifestPath)
      ? "cargo"
      : null;
}

if (!resolved) {
  process.stderr.write(
    [
      "",
      "[dslinter] Could not find the design-system scanner.",
      `        DSLINT_DEV_FLAVOR=${flavor}`,
      "",
      "        Do not use: cargo install dslint  (different crates.io project)",
      "",
      "        Options:",
      "          - cargo install --git https://github.com/jrmybtlr/DSLinter dslinter --locked",
      "          - DSLINT_BIN=/path/to/dslinter",
      "          - Install Rust and run from this repo (cargo run --bin dslinter)",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const resolvedCmd =
  resolved === "bin"
    ? [scannerBin, argv]
    : [
        "cargo",
        [
          "run",
          "--manifest-path",
          manifestPath,
          "--release",
          "--bin",
          "dslinter",
          "--",
          ...argv,
        ],
      ];

if (shouldPrintCmd) {
  process.stdout.write(`${resolvedCmd[0]} ${resolvedCmd[1].join(" ")}\n`);
  process.exit(0);
}

const child = spawn(resolvedCmd[0], resolvedCmd[1], { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
