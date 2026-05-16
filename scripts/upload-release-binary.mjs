#!/usr/bin/env node
/**
 * Build dslinter for the current machine and upload to an existing GitHub release.
 * Requires: rust, `gh` CLI authenticated (`gh auth login`).
 *
 *   node scripts/upload-release-binary.mjs v0.0.16
 *   node scripts/upload-release-binary.mjs   # uses packages/dashboard version
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseAssetBaseName } from "../packages/dashboard/scripts/resolve-dslint-binary.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(
  readFileSync(join(root, "packages/dashboard/package.json"), "utf8"),
);
const version = process.argv[2] ?? pkg.version;
const tag = version.startsWith("v") ? version : `v${version}`;
const repo = process.env.DSLINT_GITHUB_REPO?.trim() || "jrmybtlr/DSLinter";
const asset = releaseAssetBaseName();

if (!asset) {
  process.stderr.write(
    `No release asset name for ${process.platform}-${process.arch}\n`,
  );
  process.exit(1);
}

const built =
  process.platform === "win32"
    ? join(root, "target/release/dslinter.exe")
    : join(root, "target/release/dslinter");

process.stdout.write(`Building dslinter (release)…\n`);
const build = spawnSync(
  "cargo",
  ["build", "--release", "--bin", "dslinter"],
  { cwd: root, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);
if (!existsSync(built)) {
  process.stderr.write(`Missing ${built}\n`);
  process.exit(1);
}

const staged = join(root, asset);
copyFileSync(built, staged);
process.stdout.write(`Uploading ${asset} to ${repo} ${tag}…\n`);

const upload = spawnSync(
  "gh",
  ["release", "upload", tag, staged, "--repo", repo, "--clobber"],
  { stdio: "inherit" },
);
process.exit(upload.status ?? 1);
