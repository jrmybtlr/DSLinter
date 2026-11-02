import { resolve } from "node:path";
import { defaultReportPath } from "../bin/lib/project-root.mjs";

/** Resolve on-disk report path for embed/consumer dev servers. */
export function resolveReportFilePath(
  scanRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = env.DSLINTER_REPORT_PATH?.trim();
  if (fromEnv) return resolve(fromEnv);
  return defaultReportPath(scanRoot, null);
}
