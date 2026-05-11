import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoRoot = join(__dirname, "..");
const repoRoot = join(demoRoot, "..");
const outDir = join(demoRoot, "public");
const outFile = join(outDir, "dslint-report.json");

mkdirSync(outDir, { recursive: true });

const cmd = "cargo run --release -- demo -p --json";
const json = execSync(cmd, {
  cwd: repoRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trimEnd();

writeFileSync(outFile, `${json}\n`);
console.log(`Wrote ${outFile}`);

// Until every CLI build embeds `playgrounds`, ensure the field exists (mirrors Rust `build_playground_specs`).
execSync("node scripts/merge-playgrounds.mjs", { cwd: demoRoot, stdio: "inherit" });
