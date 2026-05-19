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
    lines.extend(config.ignore_globs.iter().cloned());
    lines.extend(config.exclude_globs.iter().cloned());
    IgnoreEngine::from_patterns(&lines)
}

fn in_include_scope(root: &Path, path: &Path, config: &DslintConfig) -> bool {
    if config.include_dirs.is_empty() {
        return true;
    }
    config.include_dirs.iter().any(|dir| {
        let trimmed = dir.trim().trim_matches('/');
        if trimmed.is_empty() {
            return false;
        }
        let candidate = root.join(trimmed);
        path.starts_with(&candidate)
    })
}

/// Collect component-related source paths under `root`, respecting `.gitignore`,
/// `.dslintignore`, and configured ignore globs (`ignore_globs`/`exclude_globs`).
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
        if !in_include_scope(root, &path, config) {
            continue;
        }
        let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
            continue;
        };
        let ext = ext.to_ascii_lowercase();
        // Collect every extension the parser understands (see `scan_file` in lib.rs).
        // Plain `.ts` / `.js` files are included so that components written without
        // JSX syntax (e.g. render-function components, re-export barrels) are also
        // inventoried.  Use `ignore_globs` (or legacy `exclude_globs`) in `.dslint.json` to
        // narrow this set.
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

fn is_skipped_css_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return true;
    };
    if name.ends_with(".min.css") {
        return true;
    }
    // Compiled Tailwind output — not a token source of truth.
    if name == "tw-test.css" {
        return true;
    }
    false
}

/// Collect source `.css` files under `root` (respects ignore rules; skips vendor/build dirs).
pub fn collect_css_files(root: &Path, config: &DslintConfig) -> anyhow::Result<Vec<PathBuf>> {
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
        if is_skipped_css_file(&path) {
            continue;
        }
        if let Some(ref eng) = engine {
            if eng.matches(root, &path) {
                continue;
            }
        }
        if !in_include_scope(root, &path, config) {
            continue;
        }
        let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
            continue;
        };
        if ext.eq_ignore_ascii_case("css") {
            out.push(path);
        }
    }
    out.sort();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn include_dirs_limits_component_scan_scope() {
        let tmp = tempdir().unwrap();
        let root = tmp.path();
        std::fs::create_dir_all(root.join("src/components")).unwrap();
        std::fs::create_dir_all(root.join("other")).unwrap();
        std::fs::write(root.join("src/components/Button.tsx"), "export function Button() { return null; }").unwrap();
        std::fs::write(root.join("other/Outside.tsx"), "export function Outside() { return null; }").unwrap();

        let config = DslintConfig {
            include_dirs: vec!["src/components".into()],
            ..Default::default()
        };
        let files = collect_component_files(root, &config).unwrap();
        let rels: Vec<_> = files
            .iter()
            .filter_map(|p| p.strip_prefix(root).ok())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .collect();
        assert_eq!(rels, vec!["src/components/Button.tsx"]);
    }

    #[test]
    fn ignore_globs_filters_files_like_exclude_globs() {
        let tmp = tempdir().unwrap();
        let root = tmp.path();
        std::fs::create_dir_all(root.join("src")).unwrap();
        std::fs::write(root.join("src/Keep.tsx"), "export function Keep() { return null; }").unwrap();
        std::fs::write(root.join("src/Skip.tsx"), "export function Skip() { return null; }").unwrap();

        let config = DslintConfig {
            ignore_globs: vec!["src/Skip.tsx".into()],
            ..Default::default()
        };
        let files = collect_component_files(root, &config).unwrap();
        let rels: Vec<_> = files
            .iter()
            .filter_map(|p| p.strip_prefix(root).ok())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .collect();
        assert_eq!(rels, vec!["src/Keep.tsx"]);
    }
}
