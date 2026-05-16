#!/usr/bin/env node
/**
 * `npm run dev` entry point.
 *
 * Picks the right dev flavor for the current machine:
 *   - prebuilt/vendor or PATH `dslinter` -> `npm run dev:serve`
 *   - `cargo` on PATH (contributors)     -> `npm run dev:serve`
 *   - neither                            -> `npm run dev:vite-only` with a warning
 *
 * Use `npm run dev:serve` / `npm run dev:watch` directly to force a flavor.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const SCANNER_MARKER = "design system linting";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoRoot = join(__dirname, "..");
const repoRoot = join(demoRoot, "..");

function cmdOk(cmd, args = ["--version"]) {
  return spawnSync(cmd, args, { stdio: "ignore" }).status === 0;
}

function isOurScanner(cmd) {
  const r = spawnSync(cmd, ["--help"], { encoding: "utf8" });
  return `${r.stdout ?? ""}${r.stderr ?? ""}`.includes(SCANNER_MARKER);
}

function vendoredDslinter() {
  const base = join(demoRoot, "node_modules", "dslinter", "vendor", "dslinter");
  if (process.platform === "win32") {
    const win = `${base}.exe`;
    return existsSync(win) ? win : null;
  }
  return existsSync(base) ? base : null;
}

function scannerOnPath() {
  const fromEnv = process.env.DSLINT_BIN?.trim();
  if (fromEnv && cmdOk(fromEnv, ["--help"]) && isOurScanner(fromEnv)) {
    return fromEnv;
  }
  const vendored = vendoredDslinter();
  if (vendored && isOurScanner(vendored)) return vendored;
  if (cmdOk("dslinter") && isOurScanner("dslinter")) return "dslinter";
  return null;
}

const dslinterOk = scannerOnPath();
const cargoOk =
  spawnSync("cargo", ["--version"], { stdio: "ignore" }).status === 0;

const targetScript = dslinterOk || cargoOk ? "dev:serve" : "dev:vite-only";

if (!dslinterOk && !cargoOk) {
  process.stdout.write(
    [
      "",
      "[dev] No DSLint runner found — falling back to `vite` only.",
      "      Looked for `dslinter` (vendor binary, DSLINT_BIN, or PATH) and `cargo`.",
      "      Do not use `cargo install dslint` — that is a different crates.io package.",
      "      The dashboard will read the committed public/dslint-report.json",
      "      and won't auto-update when source files change.",
      "      Install: `npm install` in demo/ (downloads a prebuilt dslinter when available)",
      "      or set DSLINT_BIN to a local build.",
      "      Contributors: `cargo build --release --bin dslinter` at the repo root.",
      "      (You can also run `npm run dev:serve` / `dev:watch` directly.)",
      "",
      "",
    ].join("\n"),
  );
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCmd, ["run", targetScript], {
  stdio: "inherit",
  cwd: demoRoot,
  env: {
    ...process.env,
    ...(dslinterOk ? { DSLINT_BIN: dslinterOk } : {}),
  },
});

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
