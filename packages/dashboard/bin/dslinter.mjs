#!/usr/bin/env node
/**
 * Runs the design-system scanner via the NAPI native binding (oxlint-style).
 * Falls back to DSLINT_BIN (cargo-built binary) when set.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);

const SCANNER_VERSION_MARKER = "design system linting";

function isOurScanner(binary) {
  const help = spawnSync(binary, ["--help"], { encoding: "utf8" });
  const out = `${help.stdout ?? ""}${help.stderr ?? ""}`;
  return out.includes(SCANNER_VERSION_MARKER);
}

function runViaNapi() {
  let runCli;
  try {
    ({ runCli } = require(join(packageRoot, "index.cjs")));
  } catch (err) {
    process.stderr.write(
      `dslinter: failed to load native binding.\n` +
        `  Run \`pnpm --filter dslinter run build:napi\` from the repo root, or reinstall dslinter.\n` +
        `  ${err instanceof Error ? err.message : err}\n`,
    );
    process.exit(127);
  }

  const argv = ["dslinter", ...args];
  const code = runCli(argv);
  process.exit(code);
}

function runViaBinary(binary) {
  const child = spawnSync(binary, args, { stdio: "inherit" });
  if (child.error && "code" in child.error && child.error.code === "ENOENT") {
    process.stderr.write(`dslinter: failed to execute ${binary}\n`);
    process.exit(127);
  }
  process.exit(child.status === null ? 1 : child.status);
}

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
  runViaBinary(fromEnv);
}

if (process.env.DSLINT_ALLOW_PATH === "1") {
  const onPath = spawnSync("dslinter", ["--help"], { encoding: "utf8" });
  const out = `${onPath.stdout ?? ""}${onPath.stderr ?? ""}`;
  if (onPath.status === 0 && out.includes(SCANNER_VERSION_MARKER)) {
    runViaBinary("dslinter");
  }
}

runViaNapi();
