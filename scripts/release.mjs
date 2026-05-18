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
import semver from "semver";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = process.env.GITHUB_REPOSITORY ?? "jrmybtlr/DSLinter";

const bump = process.argv.find((a) => ["--patch", "--minor", "--major"].includes(a));
if (!bump) {
  process.stderr.write("Usage: node scripts/release.mjs --patch|--minor|--major\n");
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function ghJson(args) {
  const r = spawnSync("gh", args, { encoding: "utf8" });
  if (r.status !== 0) {
    process.stderr.write(r.stderr ?? "");
    process.exit(r.status ?? 1);
  }
  return JSON.parse(r.stdout);
}

function sleep(seconds) {
  spawnSync("sleep", [String(seconds)]);
}

function waitForWorkflowRunId(branch, { attempts = 30, intervalSeconds = 2 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const runs = ghJson([
      "run",
      "list",
      "--repo",
      repo,
      "--workflow",
      "release-napi-bindings.yml",
      "--branch",
      branch,
      "--limit",
      "1",
      "--json",
      "databaseId",
    ]);
    const runId = runs[0]?.databaseId;
    if (runId) return runId;
    sleep(intervalSeconds);
  }
  process.stderr.write(
    `\nTimed out waiting for release-napi-bindings workflow run on branch ${branch}.\n` +
      `  Check: https://github.com/${repo}/actions/workflows/release-napi-bindings.yml\n`,
  );
  process.exit(1);
}

function readPackageVersion() {
  const pkg = JSON.parse(
    readFileSync(join(root, "packages/dashboard/package.json"), "utf8"),
  );
  return pkg.version;
}

run("pnpm", ["run", "test"]);

const bumpKind = bump.slice(2); // patch | minor | major
const currentVersion = readPackageVersion();
const nextVersion = semver.inc(currentVersion, bumpKind);
if (!nextVersion) {
  process.stderr.write(`Invalid semver bump ${bumpKind} from ${currentVersion}\n`);
  process.exit(1);
}

// changelogen expects `--release --minor` (not `--release minor`). On 0.x it downgrades
// minor→patch unless we pass `-r` with the version the caller asked for.
run("pnpm", [
  "exec",
  "changelogen",
  "--release",
  bump,
  "-r",
  nextVersion,
  "--dir",
  "packages/dashboard",
]);

const version = readPackageVersion();
const tag = `v${version}`;

process.stdout.write(
  `\nPushing commit and tag ${tag} (triggers Release NAPI bindings workflow)…\n`,
);
run("git", ["push", "origin", "HEAD"]);
run("git", ["push", "origin", tag]);

const actionsUrl = `https://github.com/${repo}/actions/workflows/release-napi-bindings.yml`;

process.stdout.write(
  `\nWaiting for GitHub Actions to publish @dslinter/binding-* and dslinter to npm…\n` +
    `  Workflow: ${actionsUrl}\n`,
);

const ghAuth = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
if (ghAuth.status !== 0) {
  process.stderr.write(
    "\ngh CLI is not authenticated — cannot watch the workflow from here.\n" +
      "  Run: gh auth login\n" +
      `  Or open: ${actionsUrl}\n` +
      "\nTag and commit were pushed successfully; CI should still run.\n",
  );
  process.exit(0);
}

const runId = waitForWorkflowRunId(tag);
process.stdout.write(`\nWatching workflow run ${runId}…\n`);

const watch = spawnSync(
  "gh",
  ["run", "watch", String(runId), "--repo", repo, "--exit-status"],
  { stdio: "inherit" },
);
if (watch.status !== 0) {
  process.stderr.write(
    "\nWorkflow did not complete successfully. Check Actions, or re-run the workflow after fixing CI.\n" +
      `  ${actionsUrl}\n`,
  );
  process.exit(watch.status ?? 1);
}

process.stdout.write("\nDone. Verify dslinter@" + version + " on npm.\n");
