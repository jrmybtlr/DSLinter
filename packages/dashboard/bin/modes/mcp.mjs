import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolveScanAndProjectRoots } from "../lib/resolve-project.mjs";
import { defaultReportPath } from "../lib/project-root.mjs";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "../..");
const startTs = join(packageRoot, "src/mcp/start.ts");
const tsxCli = require.resolve("tsx/cli");

/**
 * @param {{ argv?: string[]; cwd?: string }} [opts]
 */
export async function runMcpMode(opts = {}) {
  const argv = opts.argv ?? [];
  const cwd = opts.cwd ?? process.cwd();

  let scanPathArg = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--self-test") continue;
    if (arg.startsWith("-")) continue;
    scanPathArg = arg;
    break;
  }

  const { scanPath, projectRoot } = resolveScanAndProjectRoots(scanPathArg, cwd);
  const reportPath = defaultReportPath(scanPath, null);

  const child = spawnSync(
    process.execPath,
    [tsxCli, startTs, ...argv],
    {
      stdio: "inherit",
      cwd,
      env: {
        ...process.env,
        DSLINTER_SCAN_ROOT: scanPath,
        DSLINTER_PROJECT_ROOT: projectRoot,
        DSLINTER_REPORT_PATH: reportPath,
      },
    },
  );

  process.exit(child.status === null ? 1 : child.status);
}
