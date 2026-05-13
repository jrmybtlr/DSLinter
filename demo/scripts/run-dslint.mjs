#!/usr/bin/env node
/**
 * Run DSLint using either:
 *  - a `dslint` binary on PATH (preferred for UI testing)
 *  - `cargo run --manifest-path ../Cargo.toml` (preferred for Rust development)
 *
 * Selection:
 *  - `DSLINT_DEV_FLAVOR=bin|cargo|auto` (default: auto)
 *  - auto: use `dslint` if available, else `cargo` if available
 *
 * Extras:
 *  - `--print-cmd` prints the resolved command and exits 0 (useful for CI/dev envs).
 */
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { accessSync, constants as fsConstants } from "node:fs";
 
function cmdOk(cmd, args = ["--version"]) {
  return spawnSync(cmd, args, { stdio: "ignore" }).status === 0;
}
 
function cargoManifestPath() {
  // demo/scripts/run-dslint.mjs -> repo root Cargo.toml
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
 
const dslintOk = cmdOk("dslint");
const cargoOk = cmdOk("cargo");
const manifestPath = cargoManifestPath();
 
/** @type {"bin" | "cargo" | null} */
let resolved = null;
 
if (flavor === "bin") {
  resolved = dslintOk ? "bin" : null;
} else if (flavor === "cargo") {
  resolved = cargoOk && manifestExists(manifestPath) ? "cargo" : null;
} else {
  // auto
  resolved = dslintOk
    ? "bin"
    : cargoOk && manifestExists(manifestPath)
      ? "cargo"
      : null;
}
 
if (!resolved) {
  process.stderr.write(
    [
      "",
      "[dslint] Could not find a runnable DSLint.",
      `        DSLINT_DEV_FLAVOR=${flavor}`,
      "",
      "        Options:",
      "          - Install a prebuilt `dslint` binary so `dslint --version` works",
      "          - Install Rust so `cargo --version` works (and run from this repo)",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
 
const resolvedCmd =
  resolved === "bin"
    ? ["dslint", argv]
    : [
        "cargo",
        [
          "run",
          "--manifest-path",
          manifestPath,
          "--release",
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
