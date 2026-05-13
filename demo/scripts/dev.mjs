#!/usr/bin/env node
/**
 * `npm run dev` entry point.
 *
 * Picks the right dev flavor for the current machine:
 *   - `dslint` or `cargo` on PATH -> `npm run dev:serve` (dslint --serve first; Vite waits for
 *     tcp:127.0.0.1:7878 so the proxy does not log ECONNREFUSED while Rust builds)
 *   - neither                   -> `npm run dev:vite-only` with a warning
 *
 * Use `npm run dev:serve` / `npm run dev:watch` directly to force a flavor.
 */
import { spawn, spawnSync } from "node:child_process";

const cargoOk =
  spawnSync("cargo", ["--version"], { stdio: "ignore" }).status === 0;
const dslintOk =
  spawnSync("dslint", ["--version"], { stdio: "ignore" }).status === 0;

const targetScript = cargoOk || dslintOk ? "dev:serve" : "dev:vite-only";

if (!cargoOk && !dslintOk) {
  process.stdout.write(
    [
      "",
      "[dev] No DSLint runner found — falling back to `vite` only.",
      "      Looked for either `dslint` (prebuilt binary) or `cargo` (Rust toolchain).",
      "      The dashboard will read the committed public/dslint-report.json",
      "      and won't auto-update when source files change.",
      "      Install Rust to enable live updates: https://rustup.rs",
      "      or install a prebuilt `dslint` binary so `dslint --version` works.",
      "      (You can also run `npm run dev:serve` / `dev:watch` directly.)",
      "",
      "",
    ].join("\n"),
  );
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCmd, ["run", targetScript], { stdio: "inherit" });

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
