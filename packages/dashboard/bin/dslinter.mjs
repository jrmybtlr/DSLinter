#!/usr/bin/env node
/**
 * Forwards to the `dslint` Rust CLI on PATH. The published `dslinter` package is
 * primarily the React dashboard; report generation stays in `dslint`.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const child = spawnSync("dslint", args, { stdio: "inherit" });

if (child.error && "code" in child.error && child.error.code === "ENOENT") {
  process.stderr.write(`dslint: command not found.

The dslinter package ships the dashboard UI. JSON reports and scans are produced by the dslint CLI (Rust).

Install dslint, then run dslinter again (this command forwards to dslint):

  cargo install dslint
  # or build from the DSLint repo:
  cargo install --path .

More: https://github.com/jrmybtlr/DSLint
`);
  process.exit(127);
}

const code = child.status === null ? 1 : child.status;
process.exit(code);
