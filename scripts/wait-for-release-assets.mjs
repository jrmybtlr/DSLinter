#!/usr/bin/env node
/**
 * Poll GitHub until a release includes scanner binaries (or timeout).
 * Usage: node scripts/wait-for-release-assets.mjs [version] [repo]
 *   version defaults to packages/dashboard package.json version
 *   repo defaults to jrmybtlr/DSLinter
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(
  readFileSync(join(root, "packages/dashboard/package.json"), "utf8"),
);
const version = process.argv[2] ?? pkg.version;
const repo = process.argv[3] ?? "jrmybtlr/DSLinter";
const tag = version.startsWith("v") ? version : `v${version}`;
const timeoutMs = Number(process.env.DSLINT_RELEASE_WAIT_MS ?? 45 * 60 * 1000);
const intervalMs = 15_000;

function hasScannerAssets(release) {
  return (release.assets ?? []).some(
    (a) => a.name.startsWith("dslinter-") || a.name.startsWith("dslint-"),
  );
}

async function fetchRelease() {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "dslinter-release-wait",
      },
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

const start = Date.now();
process.stdout.write(
  `Waiting for scanner binaries on ${repo} release ${tag} (timeout ${timeoutMs / 60000}m)…\n`,
);

while (Date.now() - start < timeoutMs) {
  const release = await fetchRelease();
  if (release && hasScannerAssets(release)) {
    const names = release.assets.map((a) => a.name).join(", ");
    process.stdout.write(`OK: ${names}\n`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}

process.stderr.write(
  `Timed out waiting for binaries on https://github.com/${repo}/releases/tag/${tag}\n` +
    `  Cancel stuck Actions runs, then re-run "Release dslinter binaries" (workflow_dispatch, tag ${tag}).\n`,
);
process.exit(1);
