import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { enrichCatalog } from "./enrich-catalog.mjs";

const [path, root] = process.argv.slice(2);
let previous = "";
function tick() {
  try {
    const input = readFileSync(path, "utf8");
    if (input === previous) return;
    previous = input;
    const report = JSON.parse(input);
    if (!enrichCatalog(report, root)) return;
    // Never overwrite a newer scan produced while metadata was being resolved.
    if (readFileSync(path, "utf8") !== input) return;
    const output = JSON.stringify(report, null, 2);
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, output);
    renameSync(temporary, path);
    previous = output;
  } catch (error) {
    if (process.env.DSLINTER_DEBUG === "1") process.stderr.write(`dslinter metadata: ${error}\n`);
  }
}
tick();
setInterval(tick, 400);
