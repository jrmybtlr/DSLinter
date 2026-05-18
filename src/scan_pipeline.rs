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

pub fn read_and_scan_file(path: &Path) -> (FileScan, Option<String>) {
    match std::fs::read_to_string(path) {
        Ok(src) => {
            let scan = scan_file(path, &src);
            (scan, Some(src))
        }
        Err(e) => (
            FileScan {
                parse_errors: vec![format!(
                    "dslinter: could not read `{}`: {e}",
                    path.display()
                )],
                path: path.to_path_buf(),
                definitions: Vec::new(),
                usages: Vec::new(),
                findings: Vec::new(),
                ast_extracts: Default::default(),
            },
            None,
        ),
    }
}

/// Scan paths sequentially; returns sorted file scans and sources read successfully.
pub fn scan_paths_sequential(paths: &[PathBuf]) -> (Vec<FileScan>, HashMap<PathBuf, String>) {
    let mut files = Vec::with_capacity(paths.len());
    let mut sources = HashMap::new();
    for p in paths {
        let (scan, src) = read_and_scan_file(p);
        if let Some(s) = src {
            sources.insert(p.clone(), s);
        }
        files.push(scan);
    }
    files.sort_by(|a, b| a.path.cmp(&b.path));
    (files, sources)
}

/// Scan paths in parallel; returns sorted file scans and sources read successfully.
pub fn scan_paths_parallel(paths: &[PathBuf]) -> (Vec<FileScan>, HashMap<PathBuf, String>) {
    use rayon::prelude::*;

    let mut pairs: Vec<(FileScan, Option<String>)> = paths
        .par_iter()
        .map(|p| read_and_scan_file(p))
        .collect();

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

/// Collect component paths and scan with optional parallelism.
pub fn scan_component_files(
    root: &Path,
    config: &DslintConfig,
    parallel: bool,
) -> anyhow::Result<(Vec<FileScan>, HashMap<PathBuf, String>)> {
    let paths = crate::scan::collect_component_files(root, config)?;
    let use_parallel = should_scan_parallel(parallel, paths.len());
    Ok(if use_parallel {
        scan_paths_parallel(&paths)
    } else {
        scan_paths_sequential(&paths)
    })
}
