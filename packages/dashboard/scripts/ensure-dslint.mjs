/**
 * Best-effort download of the prebuilt `dslinter` CLI for this platform.
 * Used by postinstall and on first `dslinter` / `npx dslinter` invocation.
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { chmod, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  githubRepoFromPackage,
  releaseAssetBaseName,
  vendorBinaryPath,
} from "./resolve-dslint-binary.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = join(__dirname, "..");

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function readPackageVersion(packageRoot) {
  const pkg = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  );
  return pkg.version;
}

function releaseTag(version) {
  const o = process.env.DSLINT_RELEASE_TAG?.trim();
  if (o) return o.startsWith("v") ? o : `v${o}`;
  return `v${version}`;
}

function releaseRepo(packageRoot) {
  const override = process.env.DSLINT_GITHUB_REPO?.trim();
  if (override) return override;
  return githubRepoFromPackage(packageRoot);
}

function assetUrl(packageRoot, tag, asset) {
  return `https://github.com/${releaseRepo(packageRoot)}/releases/download/${tag}/${asset}`;
}

/**
 * @param {string} packageRoot
 * @param {{ quiet?: boolean }} [opts]
 * @returns {Promise<boolean>} true if vendored binary exists after this call
 */
export async function ensureDslintBinary(packageRoot = defaultPackageRoot, opts = {}) {
  const { quiet = false } = opts;
  const log = quiet ? () => {} : console.warn.bind(console);

  if (process.env.DSLINT_SKIP_DOWNLOAD === "1") {
    return pathExists(vendorBinaryPath(packageRoot));
  }

  const dest = vendorBinaryPath(packageRoot);
  if (await pathExists(dest)) return true;

  const asset = releaseAssetBaseName();
  if (!asset) {
    log(
      `[dslinter] No prebuilt scanner for ${process.platform}-${process.arch}.`,
    );
    return false;
  }

  const version = readPackageVersion(packageRoot);
  const tagsToTry = [releaseTag(version)];
  if (process.env.DSLINT_USE_LATEST_RELEASE !== "0") {
    tagsToTry.push("latest");
  }

  const vendorDir = join(packageRoot, "vendor");
  await mkdir(vendorDir, { recursive: true });
  const tmp = `${dest}.part`;

  for (const tag of tagsToTry) {
    const url = assetUrl(packageRoot, tag, asset);
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (res.status === 404) continue;
      if (!res.ok) {
        log(`[dslinter] Download failed (${res.status}): ${url}`);
        continue;
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
      if (tag === "latest" && !quiet) {
        log(
          `[dslinter] Installed scanner from latest GitHub release (no asset for npm v${version}).`,
        );
      }
      return true;
    } catch (err) {
      log(
        `[dslinter] Could not download: ${err instanceof Error ? err.message : err}`,
      );
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }

  log(
    `[dslinter] No GitHub release with asset "${asset}" (tried ${tagsToTry.join(", ")}).\n` +
      `  Publish tag ${releaseTag(version)} with workflow release-dslint-binaries.yml, or set DSLINT_BIN to a local build.`,
  );
  return false;
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const ok = await ensureDslintBinary();
  process.exit(ok ? 0 : 0);
}
