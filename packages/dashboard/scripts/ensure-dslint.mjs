/**
 * Best-effort download of the prebuilt `dslinter` CLI for this platform.
 * Used by postinstall and on first `dslinter` / `npx dslinter` invocation.
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { chmod, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchReleasesForVersion,
  pickReleaseAsset,
} from "./github-release.mjs";
import {
  githubRepoFromPackage,
  releaseAssetCandidateNames,
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

function releaseRepo(packageRoot) {
  const override = process.env.DSLINT_GITHUB_REPO?.trim();
  if (override) return override;
  return githubRepoFromPackage(packageRoot);
}

/**
 * @param {string} packageRoot
 * @param {{ quiet?: boolean }} [opts]
 * @returns {Promise<boolean>} true if vendored binary exists after this call
 */
export async function ensureDslintBinary(packageRoot = defaultPackageRoot, opts = {}) {
  const { quiet = false } = opts;
  const log = quiet ? () => {} : console.warn.bind(console);
  const verbose = process.env.DSLINT_VERBOSE === "1";

  if (process.env.DSLINT_SKIP_DOWNLOAD === "1") {
    return pathExists(vendorBinaryPath(packageRoot));
  }

  const dest = vendorBinaryPath(packageRoot);
  if (await pathExists(dest)) return true;

  const candidates = releaseAssetCandidateNames();
  if (candidates.length === 0) {
    log(
      `[dslinter] No prebuilt scanner for ${process.platform}-${process.arch}.`,
    );
    return false;
  }

  const version = readPackageVersion(packageRoot);
  const repo = releaseRepo(packageRoot);
  const vendorDir = join(packageRoot, "vendor");
  await mkdir(vendorDir, { recursive: true });
  const tmp = `${dest}.part`;

  let releases;
  try {
    releases = await fetchReleasesForVersion(repo, version);
  } catch (err) {
    log(
      `[dslinter] Could not query GitHub releases for ${repo}: ${err instanceof Error ? err.message : err}`,
    );
    if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
      log("  (token was set but request still failed — check repo access)");
    } else {
      log(
        "  For private repos, set GITHUB_TOKEN or GH_TOKEN with read access to releases.",
      );
    }
    return false;
  }

  if (releases.length === 0) {
    log(
      `[dslinter] No GitHub release found on ${repo} for v${version}.\n` +
        `  Publish tag v${version} with workflow release-dslint-binaries.yml (assets: ${candidates.join(" or ")}).`,
    );
    return false;
  }

  for (const release of releases) {
    const asset = pickReleaseAsset(release, candidates);
    if (!asset) {
      if (verbose) {
        log(
          `[dslinter] Release ${release.tag_name} has no asset in ${candidates.join(", ")} (has: ${release.assets.map((a) => a.name).join(", ") || "none"})`,
        );
      }
      continue;
    }

    if (verbose) {
      log(`[dslinter] Downloading ${asset.name} from ${release.tag_name}…`);
    }

    try {
      const res = await fetch(asset.browser_download_url, { redirect: "follow" });
      if (!res.ok) {
        log(`[dslinter] Download failed (${res.status}): ${asset.browser_download_url}`);
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
      if (release.tag_name !== `v${version}` && !quiet) {
        log(
          `[dslinter] Installed scanner from release ${release.tag_name} (npm v${version}).`,
        );
      }
      return true;
    } catch (err) {
      log(
        `[dslinter] Could not download ${asset.name}: ${err instanceof Error ? err.message : err}`,
      );
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }

  log(
    `[dslinter] Found releases on ${repo} but none include ${candidates.join(" or ")} for this platform.\n` +
      `  Upload platform binaries via .github/workflows/release-dslint-binaries.yml, or set DSLINT_BIN.`,
  );
  return false;
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  await ensureDslintBinary();
  process.exit(0);
}
