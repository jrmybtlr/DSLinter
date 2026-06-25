import { resolve } from "node:path";
import { defaultReportPath } from "../lib/project-root.mjs";
import {
  enrichPlaygroundsFromTs,
  watchEnrichPlaygroundsFromTs,
} from "../lib/enrich-playgrounds-from-ts.mjs";
import { spawnScanner } from "../lib/run-scanner.mjs";

/**
 * Watch mode: long-running Rust scanner + TS playground enrichment on each report write.
 *
 * @param {{
 *   scanPath: string;
 *   projectRoot: string;
 *   outputPath: string | null;
 *   scannerArgs: string[];
 * }} opts
 */
export async function runWatchMode({
  scanPath,
  projectRoot,
  outputPath,
  scannerArgs,
}) {
  const scanAbs = resolve(scanPath);
  const projectAbs = resolve(projectRoot);
  const reportPath = defaultReportPath(scanAbs, outputPath);

  const args = ["--watch", ...scannerArgs];
  if (!args.some((a) => a === "--output" || a.startsWith("--output="))) {
    args.push("--output", reportPath);
  }

  const stopEnrich = watchEnrichPlaygroundsFromTs({
    projectRoot: projectAbs,
    reportPath,
  });

  const cleanup = (signal) => {
    stopEnrich();
    if (scanner && !scanner.killed) scanner.kill(signal);
  };

  let scanner;
  try {
    scanner = await spawnScanner(args, {
      env: {
        ...process.env,
        DSLINTER_QUIET: process.env.DSLINTER_QUIET ?? "1",
      },
    });
  } catch (err) {
    stopEnrich();
    process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }

  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => cleanup(sig));
  }

  scanner.on("exit", (code, signal) => {
    stopEnrich();
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}

/**
 * One-shot enrichment after dev mode's initial scanner write (best-effort).
 * @param {{ projectRoot: string; reportPath: string }} opts
 */
export async function enrichAfterInitialScan({ projectRoot, reportPath }) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const { statSync } = await import("node:fs");
      statSync(reportPath);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  await enrichPlaygroundsFromTs({ projectRoot, reportPath });
}
