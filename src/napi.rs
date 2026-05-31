//! Node-API bindings for the `dslinter` npm package.

use std::path::PathBuf;

use napi_derive::napi;

#[napi]
pub fn run_cli(args: Vec<String>) -> napi::Result<i32> {
    Ok(crate::cli::run_cli(args))
}

/// Scan a workspace and return the full report as a JSON string (for MCP / programmatic use).
#[napi]
pub fn scan_workspace_json(root: String, parallel: Option<bool>) -> napi::Result<String> {
    let path = PathBuf::from(root);
    let report = if parallel.unwrap_or(false) {
        crate::scan_workspace_parallel(&path)
    } else {
        crate::scan_workspace(&path)
    }
    .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    serde_json::to_string(&report).map_err(|e| napi::Error::from_reason(e.to_string()))
}
