import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoRoot = join(__dirname, "..");
const dslinterBin = join(demoRoot, "..", "packages", "dashboard", "bin", "dslinter.mjs");

if (!existsSync(dslinterBin)) {
  process.stderr.write(
    "dslinter:report failed — run `npm install` in demo/ (installs dslinter).\n",
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [dslinterBin, "--report", ".", "-p", "--output", "public/dslinter-report.json"],
  { cwd: demoRoot, stdio: "inherit" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Wrote public/dslinter-report.json");
execSync("node scripts/merge-playgrounds.mjs", { cwd: demoRoot, stdio: "inherit" });
