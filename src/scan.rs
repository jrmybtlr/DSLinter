//! Repository file discovery for JSX / TSX / Vue sources.
//!
//! Ignore rules merge `.gitignore`, `.dslintignore`, and config `exclude_globs` using **last-match
//! wins** semantics (including `!` negation), best-effort vs canonical Git.

use std::path::{Path, PathBuf};

use walkdir::{DirEntry, WalkDir};

use crate::config::DslintConfig;
use crate::gitignore::{load_ignore_file_lines, IgnoreEngine};

const SKIP_DIR_NAMES: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "coverage",
    "vendor",
    "__pycache__",
];

fn is_skipped_dir(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .is_some_and(|name| SKIP_DIR_NAMES.contains(&name))
}

fn build_ignore_engine(root: &Path, config: &DslintConfig) -> anyhow::Result<Option<IgnoreEngine>> {
    let mut lines = Vec::new();
    lines.extend(load_ignore_file_lines(&root.join(".gitignore"))?);
    lines.extend(load_ignore_file_lines(&root.join(".dslintignore"))?);
    lines.extend(config.exclude_globs.iter().cloned());
    IgnoreEngine::from_patterns(&lines)
}

/// Collect component-related source paths under `root`, respecting `.gitignore`,
/// `.dslintignore`, and `exclude_globs` in config.
pub fn collect_component_files(root: &Path, config: &DslintConfig) -> anyhow::Result<Vec<PathBuf>> {
    let engine = build_ignore_engine(root, config)?;
    let mut out = Vec::new();
    for entry in WalkDir::new(root)
        .into_iter()
        .filter_entry(|e| !is_skipped_dir(e))
    {
        let Ok(entry) = entry else {
            continue;
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path().to_path_buf();
        if let Some(ref eng) = engine {
            if eng.matches(root, &path) {
                continue;
            }
        }
        let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
            continue;
        };
        let ext = ext.to_ascii_lowercase();
        // Collect every extension the parser understands (see `scan_file` in lib.rs).
        // Plain `.ts` / `.js` files are included so that components written without
        // JSX syntax (e.g. render-function components, re-export barrels) are also
        // inventoried.  Use `exclude_globs` in `.dslint.json` to narrow this set.
        if matches!(
            ext.as_str(),
            "tsx" | "jsx" | "vue" | "ts" | "js" | "mts" | "cts"
        ) {
            out.push(path);
        }
    }
    out.sort();
    Ok(out)
}
