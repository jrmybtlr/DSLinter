#!/usr/bin/env node
/**
 * Release flow: test → changelogen bump → push commit + tag → wait for NAPI publish CI → done.
 *
 * npm packages are published by `.github/workflows/release-napi-bindings.yml` (not locally).
 * Requires NPM_TOKEN secret on the repo for the publish job.
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
  `\nPushing commit and tag ${tag} (triggers Release NAPI bindings workflow)…\n`,
);
run("git", ["push", "origin", "HEAD"]);
run("git", ["push", "origin", tag]);

process.stdout.write(
  "\nWaiting for GitHub Actions to publish @dslinter/binding-* and dslinter to npm…\n",
);
const watch = spawnSync(
  "gh",
  ["run", "watch", "--repo", "jrmybtlr/DSLinter", "--exit-status"],
  { stdio: "inherit" },
);
if (watch.status !== 0) {
  process.stderr.write(
    "\nWorkflow did not complete successfully. Check Actions, or publish manually after CI finishes.\n",
  );
  process.exit(watch.status ?? 1);
}

process.stdout.write("\nDone. Verify dslinter@" + version + " on npm.\n");
