/**
 * Resolve and download GitHub release assets (API + direct URLs; supports private repos with a token).
 */

const API = "https://api.github.com";

export function githubAuthToken() {
  return (
    process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || null
  );
}

export function downloadAuthHeaders() {
  const token = githubAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function apiHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "dslinter-npm",
    "X-GitHub-Api-Version": "2022-11-28",
    ...downloadAuthHeaders(),
  };
}

/**
 * @param {string} repo `owner/name`
 * @param {string} tag `v0.0.12` or `latest`
 * @param {string} assetName
 */
export function directAssetUrl(repo, tag, assetName) {
  const file = encodeURIComponent(assetName);
  if (tag === "latest") {
    return `https://github.com/${repo}/releases/latest/download/${file}`;
  }
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${file}`;
}

/**
 * @param {string} npmVersion
 */
export function releaseTagsToTry(npmVersion) {
  const override = process.env.DSLINT_RELEASE_TAG?.trim();
  if (override) {
    return [override.startsWith("v") ? override : `v${override}`];
  }
  return [`v${npmVersion}`, npmVersion, "latest"];
}

/**
 * @param {string} repo
 * @param {string} path
 * @returns {Promise<{ data: unknown } | { notFound: true } | { error: Error }>}
 */
async function githubGet(repo, path) {
  const res = await fetch(`${API}/repos/${repo}${path}`, {
    headers: apiHeaders(),
    redirect: "follow",
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      error: new Error(`GitHub API ${res.status} for ${path}: ${body.slice(0, 200)}`),
    };
  }
  return { data: await res.json() };
}

/**
 * @param {string} repo
 * @param {string} tag e.g. `v0.0.12` or `latest`
 */
export async function fetchRelease(repo, tag) {
  const path =
    tag === "latest" ? "/releases/latest" : `/releases/tags/${encodeURIComponent(tag)}`;
  let result = await githubGet(repo, path);
  if (result.notFound && tag.startsWith("v")) {
    result = await githubGet(
      repo,
      `/releases/tags/${encodeURIComponent(tag.slice(1))}`,
    );
  }
  if ("data" in result) return result.data;
  return null;
}

/**
 * @param {string} repo
 * @param {string} npmVersion
 */
/** @param {unknown} release */
function hasScannerAssets(release) {
  const names = release?.assets?.map((a) => a.name) ?? [];
  return names.some((n) => n.startsWith("dslinter-") || n.startsWith("dslint-"));
}

export async function fetchReleasesForVersion(repo, npmVersion) {
  const out = [];
  const seen = new Set();
  /** @type {string | null} */
  let tagExistsWithoutBinaries = null;

  const consider = (release) => {
    if (!release?.tag_name) return;
    const tag = String(release.tag_name);
    const matches =
      tag === `v${npmVersion}` || tag === npmVersion;
    if (matches && !hasScannerAssets(release)) {
      tagExistsWithoutBinaries = tag;
    }
  };

  const push = (release) => {
    if (!hasScannerAssets(release)) return;
    const key = release.id ?? release.tag_name;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(release);
  };

  const vRelease = await fetchRelease(repo, `v${npmVersion}`);
  consider(vRelease);
  push(vRelease);

  const bareRelease = await fetchRelease(repo, npmVersion);
  consider(bareRelease);
  push(bareRelease);

  const latestRelease = await fetchRelease(repo, "latest");
  push(latestRelease);

  if (out.length > 0) {
    return { releases: out, apiDenied: false, tagExistsWithoutBinaries };
  }

  const listResult = await githubGet(repo, "/releases?per_page=30");
  if ("error" in listResult) {
    return { releases: out, apiDenied: false, apiError: listResult.error };
  }
  if (listResult.notFound) {
    return { releases: out, apiDenied: !githubAuthToken() };
  }

  const list = listResult.data;
  if (!Array.isArray(list)) return { releases: out, apiDenied: false };

  for (const release of list) {
    const tag = String(release.tag_name ?? "");
    if (tag === `v${npmVersion}` || tag === npmVersion) {
      push(release);
    }
  }
  if (out.length > 0) {
    return { releases: out, apiDenied: false, tagExistsWithoutBinaries };
  }

  for (const release of list) {
    const names = release.assets?.map((a) => a.name) ?? [];
    if (names.some((n) => n.startsWith("dslinter-") || n.startsWith("dslint-"))) {
      push(release);
      break;
    }
  }

  return { releases: out, apiDenied: false, tagExistsWithoutBinaries };
}

/**
 * @param {string[]} candidateNames
 * @param {{ assets: { name: string; browser_download_url: string }[] }} release
 */
export function pickReleaseAsset(release, candidateNames) {
  for (const name of candidateNames) {
    const asset = release.assets.find((a) => a.name === name);
    if (asset?.browser_download_url) return asset;
  }
  return null;
}

/**
 * Download via public/private release URLs (no API metadata required).
 * @param {(msg: string) => void} log
 */
export async function tryDirectAssetDownload(repo, npmVersion, candidateNames, log) {
  const verbose = process.env.DSLINT_VERBOSE === "1";
  const headers = downloadAuthHeaders();
  const tags = releaseTagsToTry(npmVersion);

  for (const tag of tags) {
    for (const name of candidateNames) {
      const url = directAssetUrl(repo, tag, name);
      if (verbose) log(`[dslinter] GET ${url}`);
      try {
        const res = await fetch(url, { headers, redirect: "follow" });
        if (res.status === 404) continue;
        if (!res.ok) {
          if (verbose) log(`[dslinter] ${res.status} ${url}`);
          continue;
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) continue;

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 512) continue;

        return { buf, tag, name, url };
      } catch (err) {
        if (verbose) {
          log(
            `[dslinter] ${url}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }
  }
  return null;
}
