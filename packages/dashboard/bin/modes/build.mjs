import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  defaultReportPath,
  findViteRoot,
  resolveViteBin,
} from "../lib/project-root.mjs";
import { ensureMinimalSetup } from "../lib/setup-readiness.mjs";
import { runScannerSync } from "../lib/run-scanner.mjs";

/**
 * @param {{
 *   scanPath: string;
 *   outputPath: string | null;
 *   scannerArgs: string[];
 *   yes?: boolean;
 * }}
 */
export async function runBuildMode({ scanPath, outputPath, scannerArgs, yes = false }) {
  const scanAbs = resolve(scanPath);
  const reportPath = defaultReportPath(scanAbs, outputPath);
  const viteRootForConfig = findViteRoot(scanAbs) ?? scanAbs;
  await ensureMinimalSetup({
    targetDir: viteRootForConfig,
    reportPath,
    yes,
  });
  const args = ["--report", ...scannerArgs];
  if (!args.some((a) => a === "--output" || a.startsWith("--output="))) {
    args.push("--output", reportPath);
  }

  const code = runScannerSync(args);
  if (code !== 0) process.exit(code);

  const viteRoot = findViteRoot(process.cwd());
  if (!viteRoot) {
    process.stderr.write(
      "dslinter: --build requires a Vite project (vite.config.* not found).\n",
    );
    process.exit(1);
  }

  const viteBin = resolveViteBin(viteRoot);
  if (!viteBin) {
    process.stderr.write(`dslinter: vite not installed in ${viteRoot}. Run npm install.\n`);
    process.exit(1);
  }
  const child = spawnSync(process.execPath, [viteBin, "build"], {
    cwd: viteRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      DSLINTER_SCAN_ROOT: scanAbs,
    },
  });
  process.exit(child.status === null ? 1 : child.status);
}
