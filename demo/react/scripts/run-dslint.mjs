#!/usr/bin/env node
/**
 * Run DSLint using either:
 *  - the `dslinter` npm CLI (NAPI binding from node_modules/dslinter)
 *  - `DSLINTER_BIN` / PATH `dslinter` (cargo-built binary)
 *  - `cargo run --bin dslinter` from this repo (Rust development)
 *
 * Does not use crates.io `dslint` (different project).
 */
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { accessSync, constants as fsConstants, existsSync } from "node:fs";

const SCANNER_MARKER = "design system linting";

function cmdOk(cmd, args = ["--version"]) {
  return spawnSync(cmd, args, { stdio: "ignore" }).status === 0;
}

function isOurScanner(cmd) {
  const r = spawnSync(cmd, ["--help"], { encoding: "utf8" });
  return `${r.stdout ?? ""}${r.stderr ?? ""}`.includes(SCANNER_MARKER);
}

function npmDslinterBin() {
  const __filename = fileURLToPath(import.meta.url);
  const demoRoot = path.resolve(path.dirname(__filename), "..");
  const bin = path.join(demoRoot, "node_modules", "dslinter", "bin", "dslinter.mjs");
  return existsSync(bin) ? process.execPath : null;
}

function findScannerBin() {
  const fromEnv = process.env.DSLINTER_BIN?.trim();
  if (fromEnv && cmdOk(fromEnv, ["--help"]) && isOurScanner(fromEnv)) {
    return { kind: "bin", cmd: fromEnv };
  }
  if (cmdOk("dslinter") && isOurScanner("dslinter")) {
    return { kind: "bin", cmd: "dslinter" };
  }
  const npmBin = npmDslinterBin();
  if (npmBin) {
    const script = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "node_modules",
      "dslinter",
      "bin",
      "dslinter.mjs",
    );
    if (existsSync(script)) {
      return { kind: "node", cmd: npmBin, script };
    }
  }
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
  (process.env.DSLINTER_DEV_FLAVOR ?? "auto").toLowerCase() ?? "auto";

const scanner = findScannerBin();
const cargoOk = cmdOk("cargo");
const manifestPath = cargoManifestPath();

/** @type {"napi" | "bin" | "cargo" | null} */
let resolved = null;

if (flavor === "bin") {
  resolved = scanner ? (scanner.kind === "node" ? "napi" : "bin") : null;
} else if (flavor === "cargo") {
  resolved = cargoOk && manifestExists(manifestPath) ? "cargo" : null;
} else {
  resolved = scanner
    ? scanner.kind === "node"
      ? "napi"
      : "bin"
    : cargoOk && manifestExists(manifestPath)
      ? "cargo"
      : null;
}

if (!resolved) {
  process.stderr.write(
    [
      "",
      "[dslinter] Could not find the design-system scanner.",
      `        DSLINTER_DEV_FLAVOR=${flavor}`,
      "",
      "        Do not use: cargo install dslint  (different crates.io project)",
      "",
      "        Options:",
      "          - npm install dslinter (installs platform NAPI binding)",
      "          - DSLINTER_BIN=/path/to/dslinter",
      "          - Contributors: cargo build --release --bin dslinter (repo root)",
      "          - Contributors: pnpm run build:napi && node dashboard/bin/dslinter.mjs",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

/** @type {[string, string[]]} */
const resolvedCmd =
  resolved === "napi"
    ? [scanner.cmd, [scanner.script, ...argv]]
    : resolved === "bin"
      ? [scanner.cmd, argv]
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
