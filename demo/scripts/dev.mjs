#!/usr/bin/env node
/**
 * `npm run dev` — delegates to the unified `dslinter` CLI (watch + serve + Vite).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const demoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dslinterBin = join(demoRoot, "..", "packages", "dashboard", "bin", "dslinter.mjs");

if (!existsSync(dslinterBin)) {
  process.stderr.write(
    "dslinter: run `npm install` in demo/ first (links the dslinter package).\n",
  );
  process.exit(1);
}

const child = spawn(process.execPath, [dslinterBin, "."], {
  cwd: demoRoot,
  stdio: "inherit",
});

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
