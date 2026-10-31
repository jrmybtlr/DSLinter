import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** All implicit writes belong to a per-workspace tool cache. */
export function workspaceCacheDir(root, env = process.env) {
  let base = env.DSLINTER_CACHE_DIR;
  if (!base) {
    if (process.platform === "darwin") base = join(homedir(), "Library", "Caches", "dslinter");
    else if (process.platform === "win32")
      base = join(env.LOCALAPPDATA || tmpdir(), "dslinter", "Cache");
    else base = join(env.XDG_CACHE_HOME || join(homedir(), ".cache"), "dslinter");
  }
  const key = createHash("sha256").update(resolve(root)).digest("hex").slice(0, 16);
  return join(base, key);
}
