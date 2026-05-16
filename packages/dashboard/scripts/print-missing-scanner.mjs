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

If releases exist at https://github.com/${repo}/releases/tag/v${version} but
download failed, the repo may be private — set a GitHub token then retry:

  export GITHUB_TOKEN=ghp_...   # needs read access to ${repo}
  npx dslinter

Or point at a local build:  DSLINT_BIN=/path/to/dslinter

Tip: DSLINT_VERBOSE=1 shows each download URL tried.
`);
