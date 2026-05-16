import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoRoot = join(__dirname, "..");
const outDir = join(demoRoot, "public");
const outFile = join(outDir, "dslint-report.json");

mkdirSync(outDir, { recursive: true });

const runDslint = join(__dirname, "run-dslint.mjs");
const result = spawnSync(
  process.execPath,
  [runDslint, "demo", "-p", "--json"],
  {
    cwd: demoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  },
);

if (result.status !== 0) {
  process.stderr.write(
    "dslint:report failed — install dslinter (`npm install`) or build from source (see CONTRIBUTING.md).\n",
  );
  process.exit(result.status ?? 1);
}

writeFileSync(outFile, `${(result.stdout ?? "").trimEnd()}\n`);
console.log(`Wrote ${outFile}`);

execSync("node scripts/merge-playgrounds.mjs", { cwd: demoRoot, stdio: "inherit" });
