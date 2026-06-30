import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readEnv, envIs } from "./env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "../..");
const binScript = join(__dirname, "../dslinter.mjs");
const enrichScript = join(__dirname, "enrich-report-cli.mjs");
const require = createRequire(import.meta.url);

const SCANNER_VERSION_MARKER = "design system linting";

/** Env vars for the Rust watch post-write TS enrich hook. */
export function scannerEnrichEnv(projectRoot) {
  if (process.env.DSLINTER_SKIP_TS_ENRICH === "1") {
    return {};
  }
  /** @type {Record<string, string>} */
  const env = {
    DSLINTER_ENRICH_SCRIPT: enrichScript,
    DSLINTER_NODE: process.execPath,
  };
  if (projectRoot) {
    env.DSLINTER_PROJECT_ROOT = projectRoot;
  }
  return env;
}

function applyEnrichEnv(projectRoot) {
  for (const [key, value] of Object.entries(scannerEnrichEnv(projectRoot))) {
    process.env[key] = value;
  }
}

function isOurScanner(binary) {
  const help = spawnSync(binary, ["--help"], { encoding: "utf8" });
  const out = `${help.stdout ?? ""}${help.stderr ?? ""}`;
  return out.includes(SCANNER_VERSION_MARKER);
}

/**
 * @returns {Promise<import("node:child_process").ChildProcess>}
 */
export async function spawnScanner(scannerArgs, options = {}) {
  const projectRoot = options.projectRoot ?? process.env.DSLINTER_PROJECT_ROOT;
  const enrichEnv = scannerEnrichEnv(projectRoot);
  const fromEnv = readEnv("BIN");
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`dslinter: DSLINTER_BIN not found: ${fromEnv}`);
    }
    if (!isOurScanner(fromEnv)) {
      throw new Error("dslinter: DSLINTER_BIN does not look like the DSLinter scanner");
    }
    return spawn(fromEnv, scannerArgs, {
      stdio: "inherit",
      ...options,
      env: {
        ...process.env,
        ...enrichEnv,
        ...options.env,
      },
    });
  }

  return spawn(process.execPath, [binScript, ...scannerArgs], {
    stdio: "inherit",
    ...options,
    env: {
      ...process.env,
      DSLINTER_INTERNAL: "1",
      ...enrichEnv,
      ...options.env,
    },
  });
}

/**
 * Run scanner synchronously (report / build scan). Returns exit code.
 * @param {string[]} scannerArgs
 * @param {{ captureStdout?: boolean }} [opts]
 * @returns {number}
 */
export function runScannerSync(scannerArgs, opts = {}) {
  applyEnrichEnv(opts.projectRoot);
  const fromEnv = readEnv("BIN");
  if (fromEnv) {
    const child = spawnSync(fromEnv, scannerArgs, {
      stdio: opts.captureStdout ? ["ignore", "pipe", "inherit"] : "inherit",
      encoding: opts.captureStdout ? "utf8" : undefined,
    });
    if (opts.captureStdout && child.stdout) {
      process.stdout.write(child.stdout);
    }
    return child.status === null ? 1 : child.status;
  }

  let runCli;
  try {
    ({ runCli } = require(join(packageRoot, "index.cjs")));
  } catch (err) {
    process.stderr.write(
      `dslinter: failed to load native binding.\n` +
        `  Run \`pnpm --filter dslinter run build:napi\` from the repo root, or reinstall dslinter.\n` +
        `  ${err instanceof Error ? err.message : err}\n`,
    );
    return 127;
  }

  if (opts.captureStdout) {
    const { execFileSync } = require("node:child_process");
    try {
      const out = execFileSync(process.execPath, [binScript, ...scannerArgs], {
        env: { ...process.env, DSLINTER_INTERNAL: "1" },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      });
      process.stdout.write(out);
      return 0;
    } catch (e) {
      if (e && typeof e === "object" && "status" in e && typeof e.status === "number") {
        if (e.stdout) process.stdout.write(String(e.stdout));
        return e.status;
      }
      return 1;
    }
  }

  const argv = ["dslinter", ...scannerArgs];
  return runCli(argv);
}

/**
 * Internal path: run scanner only (no orchestration).
 * @param {string[]} args
 */
export function runScannerInternal(args) {
  applyEnrichEnv(process.env.DSLINTER_PROJECT_ROOT);
  const fromEnv = readEnv("BIN");
  if (fromEnv) {
    const child = spawnSync(fromEnv, args, { stdio: "inherit" });
    process.exit(child.status === null ? 1 : child.status);
  }

  if (envIs("ALLOW_PATH")) {
    const onPath = spawnSync("dslinter", ["--help"], { encoding: "utf8" });
    const out = `${onPath.stdout ?? ""}${onPath.stderr ?? ""}`;
    if (onPath.status === 0 && out.includes(SCANNER_VERSION_MARKER)) {
      const child = spawnSync("dslinter", args, { stdio: "inherit" });
      process.exit(child.status === null ? 1 : child.status);
    }
  }

  let runCli;
  try {
    ({ runCli } = require(join(packageRoot, "index.cjs")));
  } catch (err) {
    process.stderr.write(
      `dslinter: failed to load native binding.\n` +
        `  ${err instanceof Error ? err.message : err}\n`,
    );
    process.exit(127);
  }

  const code = runCli(["dslinter", ...args]);
  process.exit(code);
}
