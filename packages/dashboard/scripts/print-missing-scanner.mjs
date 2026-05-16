import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
).version;

process.stderr.write(`dslinter: scanner binary not available.

This npm package is NOT the same as \`cargo install dslint\` on crates.io (that is a
different "design file" linter and will crash or misbehave).

To run the design-system scanner:

  1. Re-run after a GitHub release exists for v${version} (prebuilt download), or
  2. Build from this repo and point at it:
       cargo install --git https://github.com/jrmybtlr/DSLint dslinter --locked
       export DSLINT_BIN="$(command -v dslinter)"
       npx dslinter ...
  3. Or set DSLINT_BIN to your local target/release/dslinter

Releases: https://github.com/jrmybtlr/DSLint/releases
`);
