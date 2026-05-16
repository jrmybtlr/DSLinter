import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  githubRepoFromPackage,
  releaseAssetCandidateNames,
} from "./resolve-dslint-binary.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
).version;
const repo = githubRepoFromPackage(packageRoot);
const candidates = releaseAssetCandidateNames();
const triples =
  candidates.length > 0
    ? candidates.join(", ")
    : `${process.platform}-${process.arch} (no prebuilt asset name mapped)`;

process.stderr.write(`dslinter: could not find a native scanner binary for this platform.

Try:
  npm rebuild dslinter
  npm install -D dslinter

Supported release assets (when published for v${version}):
  ${triples}

Releases: https://github.com/${repo}/releases/tag/v${version}

Environment:
  DSLINT_BIN=/path/to/dslinter     point at a local or CI-built binary
  DSLINT_SKIP_DOWNLOAD=1           skip postinstall (you must set DSLINT_BIN)
  GITHUB_TOKEN=ghp_...             required for private repo release downloads

Do NOT run:  cargo install dslint
  That installs a different package on crates.io.

Contributors (build from source — last resort for end users):
  git clone https://github.com/${repo}
  cd DSLinter && cargo build --release --bin dslinter
  export DSLINT_BIN="$PWD/target/release/dslinter"

If release assets are missing, run the "Release dslinter binaries" workflow
(Actions → workflow_dispatch, tag v${version}) or:
  node scripts/upload-release-binary.mjs v${version}

Tip: DSLINT_VERBOSE=1 shows each download URL tried during postinstall.
`);
