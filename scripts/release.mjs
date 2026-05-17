#!/usr/bin/env node
/**
 * Release flow: test → changelogen bump → push commit + single tag → wait for CI → npm publish.
 *
 * Usage: node scripts/release.mjs --patch|--minor|--major
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const bump = process.argv.find((a) => ["--patch", "--minor", "--major"].includes(a));
if (!bump) {
  process.stderr.write("Usage: node scripts/release.mjs --patch|--minor|--major\n");
  process.exit(1);
}

const kind = bump.slice(2);

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function readPackageVersion() {
  const pkg = JSON.parse(
    readFileSync(join(root, "packages/dashboard/package.json"), "utf8"),
  );
  return pkg.version;
}

run("pnpm", ["run", "test"]);
run("pnpm", ["exec", "changelogen", "--release", kind, "--dir", "packages/dashboard"]);

const version = readPackageVersion();
const tag = `v${version}`;

process.stdout.write(
  `\nPushing commit and tag ${tag} (triggers Release dslinter binaries workflow)…\n`,
);
run("git", ["push", "origin", "HEAD"]);
run("git", ["push", "origin", tag]);

process.stdout.write(
  "\nWaiting for GitHub Actions to attach platform binaries to the release…\n" +
    "  (Cancel any stuck queued runs in Actions first if this times out.)\n",
);
run("node", ["scripts/wait-for-release-assets.mjs", version]);

process.stdout.write("\nPublishing dslinter to npm…\n");
run("pnpm", ["--filter", "dslinter", "publish"]);

process.stdout.write("\nDone.\n");
