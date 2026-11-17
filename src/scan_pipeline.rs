//! Read sources once and build `FileScan` + source map for workspace evaluation.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::config::DslintConfig;
use crate::model::FileScan;
use crate::scan_file;

/// Use Rayon when the tree has at least this many component files (unless `--parallel` is set).
pub const PARALLEL_SCAN_THRESHOLD: usize = 50;

pub fn should_scan_parallel(explicit_parallel: bool, file_count: usize) -> bool {
    explicit_parallel || file_count >= PARALLEL_SCAN_THRESHOLD
}

pub fn read_and_scan_file(path: &Path, config: &DslintConfig) -> (FileScan, Option<String>) {
    match std::fs::read_to_string(path) {
        Ok(src) => {
            let scan = scan_file(path, &src, config);
            (scan, Some(src))
        }
        Err(e) => (FileScan::read_error(path.to_path_buf(), e), None),
    }
}

fn merge_scan_pairs(
    pairs: Vec<(FileScan, Option<String>)>,
) -> (Vec<FileScan>, HashMap<PathBuf, String>) {
    let mut pairs = pairs;
    pairs.sort_by(|a, b| a.0.path.cmp(&b.0.path));

    let mut files = Vec::with_capacity(pairs.len());
    let mut sources = HashMap::new();
    for (scan, src) in pairs {
        if let Some(s) = src {
            sources.insert(scan.path.clone(), s);
        }
        files.push(scan);
    }
    (files, sources)
}

/// Scan paths sequentially; returns sorted file scans and sources read successfully.
pub fn scan_paths_sequential(
    paths: &[PathBuf],
    config: &DslintConfig,
) -> (Vec<FileScan>, HashMap<PathBuf, String>) {
    let pairs: Vec<_> = paths
        .iter()
        .map(|p| read_and_scan_file(p, config))
        .collect();
    merge_scan_pairs(pairs)
}

/// Scan paths in parallel; returns sorted file scans and sources read successfully.
pub fn scan_paths_parallel(
    paths: &[PathBuf],
    config: &DslintConfig,
) -> (Vec<FileScan>, HashMap<PathBuf, String>) {
    use rayon::prelude::*;

    let pairs: Vec<_> = paths
        .par_iter()
        .map(|p| read_and_scan_file(p, config))
        .collect();
    merge_scan_pairs(pairs)
}

/// Collect component paths and scan with optional parallelism.
pub fn scan_workspace_files(
    scan_root: &Path,
    project_root: &Path,
    config: &DslintConfig,
    parallel: bool,
) -> anyhow::Result<(Vec<FileScan>, HashMap<PathBuf, String>)> {
    let config = with_workspace_imports(scan_root, config);
    let paths = crate::scan::collect_component_files(scan_root, project_root, &config)?;
    Ok(if should_scan_parallel(parallel, paths.len()) {
        scan_paths_parallel(&paths, &config)
    } else {
        scan_paths_sequential(&paths, &config)
    })
}

/// Local workspace package imports must survive the third-party usage filter.
pub fn with_workspace_imports(root: &Path, config: &DslintConfig) -> DslintConfig {
    let mut config = config.clone();
    let mut alias_dirs = std::collections::HashSet::new();
    for entry in walkdir::WalkDir::new(root)
        .into_iter()
        .filter_entry(|entry| {
            !matches!(
                entry.file_name().to_str(),
                Some("node_modules" | ".git" | "target" | "vendor" | "dist" | "build")
            )
        })
    {
        let Ok(entry) = entry else {
            continue;
        };
        let name = entry.file_name().to_string_lossy();
        if name == "tsconfig.json" || name == "jsconfig.json" || name.starts_with("vite.config.") {
            let dir = entry.path().parent().unwrap();
            if alias_dirs.insert(dir.to_path_buf()) {
                config.local_import_prefixes.extend(
                    crate::project_aliases::read_aliases(dir)
                        .keys()
                        .map(|pattern| pattern.trim_end_matches('*').to_string()),
                );
            }
        }
        if name != "package.json" {
            continue;
        }
        if let Ok(source) = std::fs::read_to_string(entry.path()) {
            if let Ok(package) = serde_json::from_str::<serde_json::Value>(&source) {
                if let Some(name) = package["name"].as_str() {
                    config.local_import_prefixes.push(name.into());
                }
            }
        }
    }
    config
}
