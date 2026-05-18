/**
 * Parse dslinter CLI argv into mode + scanner args (no subprocess).
 */

const MODE_FLAGS = new Set(["--report", "--watch", "--build"]);

/** @param {string | undefined} raw */
function parseServePort(raw) {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1 || n > 65_535) return null;
  return n;
}

/**
 * @param {string[]} argv process.argv.slice(2)
 * @returns {{
 *   mode: "dev" | "report" | "watch" | "build" | "scanner";
 *   scannerArgs: string[];
 *   scanPath: string;
 *   outputPath: string | null;
 *   servePort: number | null;
 * }}
 */
export function parseDslinterArgs(argv) {
  const modes = [];
  const scannerArgs = [];

  for (const arg of argv) {
    if (MODE_FLAGS.has(arg)) modes.push(arg.slice(2));
    else scannerArgs.push(arg);
  }

  if (modes.length > 1) {
    throw new Error(
      `dslinter: mode flags are mutually exclusive (got ${modes.map((m) => `--${m}`).join(", ")})`,
    );
  }

  let servePort = null;
  let outputPath = null;
  let positional = null;

  for (let i = 0; i < scannerArgs.length; i++) {
    const arg = scannerArgs[i];
    if (arg === "--serve") {
      servePort = parseServePort(scannerArgs[i + 1]);
    } else if (arg.startsWith("--serve=")) {
      servePort = parseServePort(arg.slice("--serve=".length));
    } else if (arg === "--output" || arg === "-o") {
      outputPath = scannerArgs[i + 1] ?? null;
    } else if (arg.startsWith("--output=")) {
      outputPath = arg.slice("--output=".length);
    } else if (!arg.startsWith("-") && positional === null) {
      positional = arg;
    }
  }

  let mode;
  if (servePort !== null && modes.length === 0) {
    mode = "scanner";
  } else if (modes.length === 1) {
    mode = modes[0];
  } else if (modes.length === 0) {
    const ci = process.env.CI === "true" || process.env.CI === "1";
    mode = ci ? "report" : "dev";
  } else {
    mode = "dev";
  }

  const scanPath = positional ?? ".";

  return {
    mode,
    scannerArgs,
    scanPath,
    outputPath,
    servePort,
  };
}
