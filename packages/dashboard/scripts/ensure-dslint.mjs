/**
 * Best-effort download of the prebuilt `dslinter` CLI for this platform.
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { chmod, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchReleasesForVersion,
  githubAuthToken,
  pickReleaseAsset,
  tryDirectAssetDownload,
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
 * @param {string} dest
 * @param {{ buf: Buffer }} payload
 */
async function writeVendorBinary(dest, { buf }) {
  const tmp = `${dest}.part`;
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
}

/**
 * @param {string} packageRoot
 * @param {{ quiet?: boolean }} [opts]
 */
export async function ensureDslintBinary(packageRoot = defaultPackageRoot, opts = {}) {
  const { quiet = false } = opts;
  const log = quiet ? () => {} : console.warn.bind(console);

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
  await mkdir(join(packageRoot, "vendor"), { recursive: true });

  const direct = await tryDirectAssetDownload(repo, version, candidates, log);
  if (direct) {
    await writeVendorBinary(dest, direct);
    if (direct.tag !== `v${version}` && !quiet) {
      log(
        `[dslinter] Installed ${direct.name} from release ${direct.tag} (npm v${version}).`,
      );
    }
    return true;
  }

  let apiDenied = false;
  let tagExistsWithoutBinaries = null;
  try {
    const {
      releases,
      apiDenied: denied,
      apiError,
      tagExistsWithoutBinaries: emptyTag,
    } = await fetchReleasesForVersion(repo, version);
    apiDenied = denied;
    tagExistsWithoutBinaries = emptyTag ?? null;

    if (apiError) {
      log(
        `[dslinter] GitHub API error: ${apiError.message}`,
      );
    }

    for (const release of releases) {
      const asset = pickReleaseAsset(release, candidates);
      if (!asset) continue;

      const headers = {};
      const token = githubAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(asset.browser_download_url, {
        headers,
        redirect: "follow",
      });
      if (!res.ok) continue;

      const buf = Buffer.from(await res.arrayBuffer());
      await writeVendorBinary(dest, { buf });
      if (release.tag_name !== `v${version}` && !quiet) {
        log(
          `[dslinter] Installed ${asset.name} from release ${release.tag_name} (npm v${version}).`,
        );
      }
      return true;
    }
  } catch (err) {
    log(
      `[dslinter] GitHub API: ${err instanceof Error ? err.message : err}`,
    );
  }

  const tag = `v${version}`;
  const releasePage = `https://github.com/${repo}/releases/tag/${tag}`;

  if (tagExistsWithoutBinaries) {
    log(
      `[dslinter] GitHub release ${tagExistsWithoutBinaries} exists but has no scanner binaries attached.\n` +
        `  Run the "Release dslinter binaries" workflow on ${repo} (Actions → workflow_dispatch, tag ${tagExistsWithoutBinaries}),\n` +
        `  or push a new tag so CI uploads assets like ${candidates[0]}.\n` +
        `  ${releasePage}`,
    );
    return false;
  }

  if (apiDenied || !githubAuthToken()) {
    log(
      `[dslinter] Cannot reach ${repo} releases without authentication (GitHub returned 404).\n` +
        `  If you can open ${releasePage} in a browser, the repo is likely private.\n` +
        `  Create a fine-grained or classic token with repo read access, then:\n` +
        `    export GITHUB_TOKEN=ghp_...\n` +
        `    npx dslinter\n` +
        `  Or: npm rebuild dslinter\n` +
        `  Contributors: cargo build --release --bin dslinter (clone https://github.com/${repo})`,
    );
    return false;
  }

  log(
    `[dslinter] No release with asset ${candidates.join(" or ")} on ${repo} for ${tag}.\n` +
      `  Create ${releasePage} and run release-dslint-binaries.yml, or set DSLINT_BIN.`,
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
