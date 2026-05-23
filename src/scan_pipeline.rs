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

fn merge_scan_pairs(pairs: Vec<(FileScan, Option<String>)>) -> (Vec<FileScan>, HashMap<PathBuf, String>) {
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
    let paths = crate::scan::collect_component_files(scan_root, project_root, config)?;
    Ok(if should_scan_parallel(parallel, paths.len()) {
        scan_paths_parallel(&paths, config)
    } else {
        scan_paths_sequential(&paths, config)
    })
}
