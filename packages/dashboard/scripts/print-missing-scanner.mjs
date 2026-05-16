import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { githubRepoFromPackage } from "./resolve-dslint-binary.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
).version;
const repo = githubRepoFromPackage(packageRoot);

process.stderr.write(`dslinter: scanner binary not available.

Do NOT run:  cargo install dslint
  That installs a different package on crates.io (design-file linter).

Install the design-system scanner from this repo instead:

  cargo install --git https://github.com/${repo} dslinter --locked
  export DSLINT_BIN="$(command -v dslinter)"
  npx dslinter ...

If the release page exists but has no files, GitHub Actions may still be queued or failed:
  Actions → "Release dslinter binaries" → Run workflow (tag v${version})
  Or upload from this repo:  node scripts/upload-release-binary.mjs v${version}

Or point at a local build:  DSLINT_BIN=/path/to/dslinter

Tip: DSLINT_VERBOSE=1 shows each download URL tried.
`);
