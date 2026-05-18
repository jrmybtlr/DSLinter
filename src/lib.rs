//! DSLint — design-system component inventory and governance signals (MVP).

pub mod class_strings;
pub mod code_quality;
pub mod config;
pub mod css_tokens;
pub mod directives;
pub mod ecma;
pub mod gitignore;
pub mod lines;
pub mod model;
pub mod playground_emit;
pub mod report;
pub mod rules;
pub mod scan;
pub mod scan_pipeline;
mod text_patterns;
mod ts_shape_map;
pub mod vue;
pub mod watch;

pub mod cli;

#[cfg(feature = "napi")]
mod napi;

use std::path::Path;

use std::collections::HashMap;
use std::path::PathBuf;

use crate::model::{FileScan, WorkspaceReport};
pub use scan_pipeline::PARALLEL_SCAN_THRESHOLD;

/// Parse a single supported source file into definitions + JSX/Vue usages.
pub fn scan_file(path: &Path, source: &str) -> FileScan {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "vue" => vue::analyze_vue_file(path, source),
        "tsx" | "jsx" | "js" | "ts" | "mts" | "cts" => ecma::analyze_ecma_file(path, source),
        _ => FileScan {
            path: path.to_path_buf(),
            definitions: Vec::new(),
            usages: Vec::new(),
            parse_errors: vec![format!("dslinter: unsupported extension `{ext}`")],
            findings: Vec::new(),
            ast_extracts: Default::default(),
        },
    }
}

fn scan_workspace_with_parallel(
    root: &Path,
    parallel: bool,
) -> anyhow::Result<WorkspaceReport> {
    let config = config::DslintConfig::load_from_root(root)?;
    let (files, sources) = scan_pipeline::scan_component_files(root, &config, parallel)?;
    Ok(rules::evaluate_workspace(
        root.to_path_buf(),
        files,
        sources,
        &config,
    ))
}

/// Scan `root` sequentially (deterministic ordering).
pub fn scan_workspace(root: &Path) -> anyhow::Result<WorkspaceReport> {
    scan_workspace_with_parallel(root, false)
}

/// Scan `root` in parallel for large repositories.
pub fn scan_workspace_parallel(root: &Path) -> anyhow::Result<WorkspaceReport> {
    scan_workspace_with_parallel(root, true)
}

/// Scan `root`, using parallel file reads when the tree is large (see [`PARALLEL_SCAN_THRESHOLD`]).
pub fn scan_workspace_auto(root: &Path, explicit_parallel: bool) -> anyhow::Result<WorkspaceReport> {
    let config = config::DslintConfig::load_from_root(root)?;
    let paths = scan::collect_component_files(root, &config)?;
    let parallel = scan_pipeline::should_scan_parallel(explicit_parallel, paths.len());
    let (files, sources) = if parallel {
        scan_pipeline::scan_paths_parallel(&paths)
    } else {
        scan_pipeline::scan_paths_sequential(&paths)
    };
    Ok(rules::evaluate_workspace(
        root.to_path_buf(),
        files,
        sources,
        &config,
    ))
}

/// Re-scan a single file and update workspace caches (watch mode).
pub fn rescan_file(
    path: &Path,
    files: &mut Vec<FileScan>,
    sources: &mut HashMap<PathBuf, String>,
) {
    let (scan, src) = scan_pipeline::read_and_scan_file(path);
    if let Some(s) = src {
        sources.insert(path.to_path_buf(), s);
    } else {
        sources.remove(path);
    }
    if let Some(existing) = files.iter_mut().find(|f| f.path == *path) {
        *existing = scan;
    } else {
        files.push(scan);
    }
}
