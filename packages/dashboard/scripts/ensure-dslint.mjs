/**
 * Best-effort download of the prebuilt `dslint` CLI for this platform.
 * Runs on `npm install dslinter` (postinstall). Exits 0 even when the binary
 * is missing (no release yet / offline) so installs never fail.
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { chmod, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseAssetBaseName, vendorBinaryPath } from "./resolve-dslint-binary.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  return pkg.version;
}

function releaseTag(version) {
  const o = process.env.DSLINT_RELEASE_TAG?.trim();
  if (o) return o.startsWith("v") ? o : `v${o}`;
  return `v${version}`;
}

async function main() {
  if (process.env.DSLINT_SKIP_DOWNLOAD === "1") return;

  const dest = vendorBinaryPath(packageRoot);
  if (await pathExists(dest)) return;

  const asset = releaseAssetBaseName();
  if (!asset) {
    console.warn(
      `[dslinter] No prebuilt dslint for ${process.platform}-${process.arch}. Install Rust and put dslint on PATH, or set DSLINT_SKIP_DOWNLOAD=1.`,
    );
    return;
  }

  const version = readPackageVersion();
  const tag = releaseTag(version);
  const repo = process.env.DSLINT_GITHUB_REPO?.trim() || "jrmybtlr/DSLint";
  const url = `https://github.com/${repo}/releases/download/${tag}/${asset}`;

  const vendorDir = join(packageRoot, "vendor");
  await mkdir(vendorDir, { recursive: true });

  const tmp = `${dest}.part`;

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (res.status === 404) {
      console.warn(
        `[dslinter] No GitHub release asset at ${url}\n` +
          `  Create release ${tag} with ${asset} (see .github/workflows/release-dslint-binaries.yml), or install dslint via cargo / PATH.`,
      );
      return;
    }
    if (!res.ok) {
      console.warn(`[dslinter] Download failed (${res.status}): ${url}`);
      return;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(tmp, buf);

    try {
      if (await pathExists(dest)) unlinkSync(dest);
    } catch {
      /* ignore */
    }
    renameSync(tmp, dest);

    if (process.platform !== "win32") {
      await chmod(dest, 0o755);
    }
  } catch (err) {
    console.warn(`[dslinter] Could not download dslint: ${err instanceof Error ? err.message : err}`);
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

await main();
