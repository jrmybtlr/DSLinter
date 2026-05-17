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
const repo = process.env.GITHUB_REPOSITORY ?? "jrmybtlr/DSLinter";

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

function ghJson(args) {
  const r = spawnSync("gh", args, { encoding: "utf8" });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || "gh command failed\n");
    process.exit(r.status ?? 1);
  }
  return JSON.parse(r.stdout);
}

function waitForWorkflowRunId() {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const runs = ghJson([
      "run",
      "list",
      "--repo",
      repo,
      "-w",
      "release-napi-bindings.yml",
      "--branch",
      tag,
      "--limit",
      "5",
      "--json",
      "databaseId,status,headBranch",
    ]);
    const run = runs.find((r) => r.headBranch === tag);
    if (run) return run.databaseId;
    spawnSync("sleep", ["3"], { stdio: "ignore" });
  }
  process.stderr.write(
    `\nTimed out waiting for workflow run for ${tag}.\n` + `  ${actionsUrl}\n`,
  );
  process.exit(1);
}

const runId = waitForWorkflowRunId();
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
