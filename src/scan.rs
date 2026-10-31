//! Repository file discovery for JSX / TSX / Vue sources.
//!
//! Ignore rules merge `.gitignore`, `.dslinterignore`, and config `exclude_globs` using **last-match
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
    "dashboard-dist",
    ".output",
    ".cache",
    ".turbo",
];

fn is_skipped_dir(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .is_some_and(|name| SKIP_DIR_NAMES.contains(&name))
}

fn build_ignore_engine(_root: &Path, config: &DslintConfig) -> anyhow::Result<Option<IgnoreEngine>> {
    let mut lines = Vec::new();
    lines.extend(config.ignore_globs.iter().cloned());
    lines.extend(config.exclude_globs.iter().cloned());
    IgnoreEngine::from_patterns(&lines)
}

fn path_has_prefix(path: &Path, prefix: &Path) -> bool {
    if path.starts_with(prefix) {
        return true;
    }
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        path_starts_with_ignore_case(path, prefix)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn path_starts_with_ignore_case(path: &Path, prefix: &Path) -> bool {
    use std::path::Component;

    let mut prefix_components = prefix.components();
    let mut path_components = path.components();
    loop {
        match (prefix_components.next(), path_components.next()) {
            (None, _) => return true,
            (_, None) => return false,
            (Some(Component::Prefix(a)), Some(Component::Prefix(b))) if a == b => {}
            (Some(Component::RootDir), Some(Component::RootDir)) => {}
            (Some(Component::CurDir), Some(Component::CurDir)) => {}
            (Some(Component::ParentDir), Some(Component::ParentDir)) => {}
            (Some(a), Some(b)) if a.as_os_str().eq_ignore_ascii_case(b.as_os_str()) => {}
            _ => return false,
        }
    }
}

pub fn in_include_scope(root: &Path, path: &Path, config: &DslintConfig) -> bool {
    if config.include_dirs.is_empty() {
        return true;
    }
    config.include_dirs.iter().any(|dir| {
        let trimmed = dir.trim().trim_matches('/');
        if trimmed.is_empty() {
            return false;
        }
        let candidate = root.join(trimmed);
        path_has_prefix(path, &candidate)
    })
}

fn walk_files<F>(
    scan_root: &Path,
    project_root: &Path,
    config: &DslintConfig,
    mut accept: F,
) -> anyhow::Result<Vec<PathBuf>>
where
    F: FnMut(&Path) -> bool,
{
    let engine = build_ignore_engine(project_root, config)?;
    let mut scoped_ignores = Vec::new();
    let mut seen_dirs = std::collections::HashSet::new();
    let mut add_ignore = |dir: &Path| -> anyhow::Result<()> {
        if seen_dirs.insert(dir.to_path_buf()) {
            let mut lines = load_ignore_file_lines(&dir.join(".gitignore"))?;
            lines.extend(load_ignore_file_lines(&dir.join(".dslinterignore"))?);
            if let Some(engine) = IgnoreEngine::from_patterns(&lines)? { scoped_ignores.push((dir.to_path_buf(), engine)); }
        }
        Ok(())
    };
    let ancestors: Vec<_> = scan_root.ancestors().collect();
    for dir in ancestors.into_iter().rev() { add_ignore(dir)?; }
    // Load nested scopes before matching their files; WalkDir visits parent directories first.
    for entry in WalkDir::new(scan_root).into_iter().filter_entry(|e| !is_skipped_dir(e)) {
        if let Ok(entry) = entry { if entry.file_type().is_dir() { add_ignore(entry.path())?; } }
    }
    let mut out = Vec::new();
    for entry in WalkDir::new(scan_root)
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
        let mut ignored = false;
        for (scope, matcher) in &scoped_ignores { if let Some(decision) = matcher.decision(scope, &path) { ignored = decision; } }
        if let Some(ref eng) = engine {
            if let Some(decision) = eng.decision(project_root, &path) { ignored = decision; }
        }
        if ignored { continue; }
        if accept(&path) {
            out.push(path);
        }
    }
    out.sort();
    Ok(out)
}

/// Collect component-related source paths under `scan_root`, respecting `.gitignore`,
/// `.dslinterignore`, and configured ignore globs (`ignore_globs`/`exclude_globs`).
/// `include_dirs` in config are resolved relative to `project_root`.
pub fn collect_component_files(
    scan_root: &Path,
    project_root: &Path,
    config: &DslintConfig,
) -> anyhow::Result<Vec<PathBuf>> {
    let scan_canon = std::fs::canonicalize(scan_root).unwrap_or_else(|_| scan_root.to_path_buf());
    walk_files(scan_root, project_root, config, |path| {
        let path_canon = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        if !path_canon.starts_with(&scan_canon) {
            return false;
        }
        let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
            return false;
        };
        let ext = ext.to_ascii_lowercase();
        matches!(ext.as_str(), "tsx" | "jsx" | "vue" | "ts" | "js" | "mts" | "mjs")
    })
}

fn is_skipped_css_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return true;
    };
    if name.ends_with(".min.css") {
        return true;
    }
    if name == "tw-test.css" {
        return true;
    }
    false
}

/// Collect source `.css` files under `root` (respects ignore rules; skips vendor/build dirs).
pub fn collect_css_files(root: &Path, config: &DslintConfig) -> anyhow::Result<Vec<PathBuf>> {
    walk_files(root, root, config, |path| {
        if is_skipped_css_file(path) {
            return false;
        }
        path.extension()
            .and_then(|e| e.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("css"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn include_dirs_keeps_usage_scan_workspace_wide() {
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
        let files = collect_component_files(root, root, &config).unwrap();
        let rels: Vec<_> = files
            .iter()
            .filter_map(|p| p.strip_prefix(root).ok())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .collect();
        assert_eq!(rels, vec!["other/Outside.tsx", "src/components/Button.tsx"]);
    }

    #[test]
    fn scan_subdirectory_excludes_paths_outside_scan_root() {
        let tmp = tempdir().unwrap();
        let root = tmp.path();
        std::fs::create_dir_all(root.join("resources/js/components")).unwrap();
        std::fs::create_dir_all(root.join("resources/js/layouts/auth")).unwrap();
        std::fs::write(
            root.join("resources/js/components/Button.tsx"),
            "export function Button() { return null; }",
        )
        .unwrap();
        std::fs::write(
            root.join("resources/js/layouts/auth/Split.tsx"),
            "export function Split() { return null; }",
        )
        .unwrap();
        std::fs::write(
            root.join(".dslinter.json"),
            r#"{"include_dirs":["resources/js"]}"#,
        )
        .unwrap();

        let config = DslintConfig::load_from_root(root).unwrap();
        let scan_root = root.join("resources/js/components");
        let files = collect_component_files(&scan_root, root, &config).unwrap();
        let rels: Vec<_> = files
            .iter()
            .filter_map(|p| p.strip_prefix(root).ok())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .collect();
        assert_eq!(rels, vec!["resources/js/components/Button.tsx"]);
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
        let files = collect_component_files(root, root, &config).unwrap();
        let rels: Vec<_> = files
            .iter()
            .filter_map(|p| p.strip_prefix(root).ok())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .collect();
        assert_eq!(rels, vec!["src/Keep.tsx"]);
    }

    #[test]
    fn includes_plain_ts_and_js_for_import_resolution() {
        let tmp = tempdir().unwrap();
        let root = tmp.path();
        std::fs::create_dir_all(root.join("src/components")).unwrap();
        std::fs::write(
            root.join("src/components/Button.tsx"),
            "export function Button() { return null; }",
        )
        .unwrap();
        std::fs::write(
            root.join("src/components/utils.ts"),
            "export const x = 1;",
        )
        .unwrap();
        std::fs::write(
            root.join("src/components/legacy.js"),
            "export function Legacy() { return null; }",
        )
        .unwrap();

        let config = DslintConfig::default();
        let files = collect_component_files(root, root, &config).unwrap();
        let rels: Vec<_> = files
            .iter()
            .filter_map(|p| p.strip_prefix(root).ok())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .collect();
        assert_eq!(rels, vec!["src/components/Button.tsx", "src/components/legacy.js", "src/components/utils.ts"]);
    }

    #[test]
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    fn include_dirs_matches_mismatched_directory_casing() {
        let tmp = tempdir().unwrap();
        let root = tmp.path();
        std::fs::create_dir_all(root.join("resources/js/Components")).unwrap();
        std::fs::write(
            root.join("resources/js/Components/Button.jsx"),
            "export function Button() { return null; }",
        )
        .unwrap();

        let config = DslintConfig {
            include_dirs: vec!["resources/js/components".into()],
            ..Default::default()
        };
        let files = collect_component_files(root, root, &config).unwrap();
        let rels: Vec<_> = files
            .iter()
            .filter_map(|p| p.strip_prefix(root).ok())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .collect();
        assert_eq!(rels, vec!["resources/js/Components/Button.jsx"]);
    }

    #[test]
    fn include_dirs_does_not_limit_css_scan_scope() {
        let tmp = tempdir().unwrap();
        let root = tmp.path();
        std::fs::create_dir_all(root.join("src/components")).unwrap();
        std::fs::create_dir_all(root.join("src/styles")).unwrap();
        std::fs::write(root.join("src/components/Button.tsx"), "export function Button() { return null; }").unwrap();
        std::fs::write(root.join("src/styles/global.css"), ":root { --color-brand: #000; }").unwrap();

        let config = DslintConfig {
            include_dirs: vec!["src/components".into()],
            ..Default::default()
        };
        let files = collect_css_files(root, &config).unwrap();
        let rels: Vec<_> = files
            .iter()
            .filter_map(|p| p.strip_prefix(root).ok())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .collect();
        assert_eq!(rels, vec!["src/styles/global.css"]);
    }
}
