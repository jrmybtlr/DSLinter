//! DSLint — design-system component inventory and governance signals (MVP).

pub mod config;
pub mod directives;
pub mod ecma;
pub mod gitignore;
pub mod model;
pub mod playground_emit;
pub mod report;
pub mod rules;
pub mod scan;
pub mod smells;
mod ts_shape_map;
pub mod vue;

use std::path::Path;

use crate::model::{FileScan, WorkspaceReport};

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
            parse_errors: vec![format!("dslint: unsupported extension `{ext}`")],
            findings: Vec::new(),
        },
    }
}

/// Scan `root` sequentially (deterministic ordering).
pub fn scan_workspace(root: &Path) -> anyhow::Result<WorkspaceReport> {
    let config = config::DslintConfig::load_from_root(root)?;
    let paths = scan::collect_component_files(root, &config)?;
    let mut files: Vec<FileScan> = paths
        .into_iter()
        .filter_map(|p| {
            std::fs::read_to_string(&p)
                .ok()
                .map(|src| scan_file(&p, &src))
        })
        .collect();
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(rules::evaluate_workspace(
        root.to_path_buf(),
        files,
        &config,
    ))
}

/// Scan `root` in parallel for large repositories.
pub fn scan_workspace_parallel(root: &Path) -> anyhow::Result<WorkspaceReport> {
    use rayon::prelude::*;
    let config = config::DslintConfig::load_from_root(root)?;
    let paths = scan::collect_component_files(root, &config)?;
    let mut files: Vec<FileScan> = paths
        .par_iter()
        .filter_map(|p| {
            std::fs::read_to_string(p)
                .ok()
                .map(|src| scan_file(p, &src))
        })
        .collect();
    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(rules::evaluate_workspace(
        root.to_path_buf(),
        files,
        &config,
    ))
}
