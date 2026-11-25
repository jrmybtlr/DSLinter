import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * One explorer per report file. Two explorers sharing a report each run a catalog
 * worker, and when their enrichment differs (e.g. different DSLinter versions) the
 * workers rewrite each other's output forever, flipping the dashboard between states.
 */

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return error?.code === "EPERM";
  }
}

function readLock(path) {
  try {
    const lock = JSON.parse(readFileSync(path, "utf8"));
    return lock && typeof lock === "object" ? lock : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} reportPath
 * @param {{ pid?: number; url: string; version: string }} owner
 * @returns {{ acquired: true; release: () => void } | { acquired: false; holder: { pid: number; url?: string; version?: string } }}
 */
export function acquireExploreLock(reportPath, { pid = process.pid, url, version }) {
  const path = `${reportPath}.lock`;
  // A first run creates the cache folder after this point.
  mkdirSync(dirname(path), { recursive: true });
  const body = JSON.stringify({
    pid,
    url,
    version,
    startedAt: new Date().toISOString(),
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(path, body, { flag: "wx" });
      return {
        acquired: true,
        release() {
          if (readLock(path)?.pid === pid) rmSync(path, { force: true });
        },
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    const holder = readLock(path);
    if (holder && holder.pid !== pid && isAlive(holder.pid)) return { acquired: false, holder };
    // Stale lock from a crashed or killed explorer.
    rmSync(path, { force: true });
  }
  throw new Error(`Could not lock ${path}`);
}

/** Message for a second explorer started against a workspace that already has one. */
export function explorerConflictMessage(holder, version, scanPath) {
  const where = holder.url ? ` at ${holder.url}` : "";
  if (holder.version && holder.version !== version)
    return (
      `dslinter: DSLinter ${holder.version} is already exploring ${scanPath}${where} (pid ${holder.pid}).\n` +
      `Stop it first (Ctrl-C in its terminal, or \`kill ${holder.pid}\`), then start ${version} again.\n`
    );
  return `dslinter: already exploring ${scanPath}${where} (pid ${holder.pid}). Opening that dashboard instead.\n`;
}
