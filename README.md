# DSLint

Rust CLI that inventories **JSX / TSX / Vue** components in a local repository, rolls up **usage frequency** (Storybook-style visibility without story files), and emits **governance signals** for design-system quality.

## Usage

```bash
cargo build --release
./target/release/dslint /path/to/repo          # human summary
./target/release/dslint /path/to/repo --json   # machine-readable report
./target/release/dslint -p /path/to/repo       # parallel scan (large trees)
```

Optional config (repository root): `.dslint.json` or `dslint.json`:

```json
{
  "deprecated_components": ["LegacyButton"],
  "known_tokens": ["--color-", "spacing.", "theme."],
  "ownership": {
    "design-system": ["packages/ui/", "src/ds/"]
  }
}
```

## Demo

See [`demo/`](demo/) for a **Vite + React + TypeScript + Tailwind** app with ten “good” and ten “bad” components plus `demo/.dslint.json`.

```bash
cd demo && npm install && npm run dev
cargo run --release -- demo -p
```

## MVP scope

- Component definitions (functions, classes, `const` arrows, `forwardRef` / `memo`, exports)
- PascalCase JSX / Vue template usage with prop lists (variant-surface hint)
- Duplicate definition detection, deprecation usage, hardcoded hex colors, `<img>` missing `alt`
- Heuristic governance scores and `--json` output for dashboards / CI

Roadmap aligns with phased governance (tokens, a11y depth, drift, AI compliance) described in project docs.
