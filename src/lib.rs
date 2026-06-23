//! DSLinter — design-system component inventory and governance signals (MVP).

pub mod class_strings;
pub mod code_quality;
pub mod config;
pub mod cva_extract;
pub mod css_tokens;
pub mod directives;
pub mod ecma;
pub mod gitignore;
pub mod import_filter;
pub mod lines;
pub mod model;
pub mod playground_emit;
pub mod report;
pub mod rules;
pub mod scan;
pub mod scan_pipeline;
pub mod token_values;
mod text_patterns;
mod ts_shape_map;
#[macro_use]
mod util;
pub mod vue;
pub mod watch;

pub mod cli;

#[cfg(feature = "napi")]
mod napi;

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::config::DslintConfig;
use crate::import_filter::ImportFilter;
use crate::model::{FileScan, WorkspaceReport};
pub use scan_pipeline::PARALLEL_SCAN_THRESHOLD;

/// Parse a single supported source file into definitions + JSX/Vue usages.
pub fn scan_file(path: &Path, source: &str, config: &DslintConfig) -> FileScan {
    let import_filter = ImportFilter::from_config(config);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "vue" => vue::analyze_vue_file(path, source, &import_filter),
        "tsx" | "jsx" | "js" | "ts" | "mts" | "cts" => {
            ecma::analyze_ecma_file_with_filter(path, source, &import_filter)
        }
        _ => FileScan::unsupported_ext(path.to_path_buf(), &ext),
    }
}

/// Scan `root` sequentially (deterministic ordering).
pub fn scan_workspace(root: &Path) -> anyhow::Result<WorkspaceReport> {
    scan_workspace_auto(root, false)
}

/// Scan `root` in parallel for large repositories.
pub fn scan_workspace_parallel(root: &Path) -> anyhow::Result<WorkspaceReport> {
    scan_workspace_auto(root, true)
}

/// Scan `root`, using parallel file reads when the tree is large (see [`PARALLEL_SCAN_THRESHOLD`]).
pub fn scan_workspace_auto(root: &Path, explicit_parallel: bool) -> anyhow::Result<WorkspaceReport> {
    let (project_root, config) = config::DslintConfig::load_nearest(root)?;
    let (files, sources) =
        scan_pipeline::scan_workspace_files(root, &project_root, &config, explicit_parallel)?;
    Ok(rules::evaluate_workspace(
        project_root,
        files,
        sources,
        &config,
    ))
}

/// Re-scan a single file and update workspace caches (watch mode).
pub fn rescan_file(
    path: &Path,
    config: &DslintConfig,
    files: &mut Vec<FileScan>,
    sources: &mut HashMap<PathBuf, String>,
) {
    let (scan, src) = scan_pipeline::read_and_scan_file(path, config);
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
