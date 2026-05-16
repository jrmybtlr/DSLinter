/**
 * Resolve GitHub release assets via the REST API (works with exact names + legacy names).
 */

const API = "https://api.github.com";

function apiHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "dslinter-npm",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token =
    process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * @param {string} repo `owner/name`
 * @param {string} path
 */
async function githubGet(repo, path) {
  const res = await fetch(`${API}/repos/${repo}${path}`, {
    headers: apiHeaders(),
    redirect: "follow",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} for ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * @param {string} repo
 * @param {string} tag e.g. `v0.0.11` or `latest`
 */
export async function fetchRelease(repo, tag) {
  if (tag === "latest") {
    return githubGet(repo, "/releases/latest");
  }
  const byTag = await githubGet(repo, `/releases/tags/${encodeURIComponent(tag)}`);
  if (byTag) return byTag;
  // Some releases use tag without `v` prefix.
  if (tag.startsWith("v")) {
    return githubGet(repo, `/releases/tags/${encodeURIComponent(tag.slice(1))}`);
  }
  return null;
}

/**
 * @param {string} repo
 * @param {string} npmVersion e.g. `0.0.11`
 */
export async function fetchReleasesForVersion(repo, npmVersion) {
  const out = [];
  const seen = new Set();

  const push = (release) => {
    if (!release?.assets?.length) return;
    const key = release.id ?? release.tag_name;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(release);
  };

  push(await fetchRelease(repo, `v${npmVersion}`));
  push(await fetchRelease(repo, npmVersion));
  push(await fetchRelease(repo, "latest"));

  if (out.length > 0) return out;

  const list = await githubGet(repo, "/releases?per_page=30");
  if (!Array.isArray(list)) return out;

  for (const release of list) {
    const tag = String(release.tag_name ?? "");
    if (tag === `v${npmVersion}` || tag === npmVersion) {
      push(release);
    }
  }
  if (out.length > 0) return out;

  // Newest release that has any scanner-looking asset.
  for (const release of list) {
    const names = release.assets?.map((a) => a.name) ?? [];
    if (names.some((n) => n.startsWith("dslinter-") || n.startsWith("dslint-"))) {
      push(release);
      break;
    }
  }

  return out;
}

/**
 * @param {string[]} candidateNames
 * @param {{ assets: { name: string; browser_download_url: string }[] }} release
 * @returns {{ name: string; browser_download_url: string } | null}
 */
export function pickReleaseAsset(release, candidateNames) {
  for (const name of candidateNames) {
    const asset = release.assets.find((a) => a.name === name);
    if (asset?.browser_download_url) return asset;
  }
  return null;
}
