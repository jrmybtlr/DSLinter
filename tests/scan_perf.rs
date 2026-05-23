//! Scan performance smoke tests (single read + optional parallelism).

use std::fs;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use dslinter::scan_pipeline::{scan_paths_parallel, scan_paths_sequential, PARALLEL_SCAN_THRESHOLD};

#[test]
fn demo_workspace_scan_completes_within_budget() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("demo");
    let config = dslinter::config::DslintConfig::load_from_root(&root).expect("config");
    let paths =
        dslinter::scan::collect_component_files(&root, &root, &config).expect("paths");
    assert!(!paths.is_empty(), "demo should have component files");

    let start = Instant::now();
    let report = dslinter::scan_workspace(&root).expect("scan");
    let elapsed = start.elapsed();
    assert!(!report.files.is_empty());
    // Loose ceiling so CI stays stable; catches accidental 10x regressions.
    assert!(
        elapsed < Duration::from_secs(30),
        "demo scan took {:?}",
        elapsed
    );
}

#[test]
fn synthetic_tree_uses_single_read_pipeline() {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    for i in 0..8 {
        let path = root.join(format!("Component{i}.tsx"));
        let body = format!(
            r#"export function C{i}() {{
  return <motion.div className="text-[#abc] bg-red-500" />;
}}
"#
        );
        fs::write(&path, body).expect("write");
    }

    let paths: Vec<PathBuf> = (0..8).map(|i| root.join(format!("Component{i}.tsx"))).collect();

    let config = dslinter::config::DslintConfig::default();
    let seq_start = Instant::now();
    let (seq_files, seq_sources) = scan_paths_sequential(&paths, &config);
    let seq_elapsed = seq_start.elapsed();

    let par_start = Instant::now();
    let (par_files, par_sources) = scan_paths_parallel(&paths, &config);
    let par_elapsed = par_start.elapsed();

    assert_eq!(seq_files.len(), 8);
    assert_eq!(par_files.len(), 8);
    assert_eq!(seq_sources.len(), 8);
    assert_eq!(par_sources.len(), 8);

    let config = dslinter::config::DslintConfig::default();
    let seq_report = dslinter::rules::evaluate_workspace(
        root.to_path_buf(),
        seq_files,
        seq_sources,
        &config,
    );
    assert!(
        seq_report
            .findings
            .iter()
            .any(|f| f.rule_id.starts_with("token-")),
        "expected token findings in synthetic tree"
    );

    // Sanity: both modes finish quickly on tiny trees.
    assert!(seq_elapsed < Duration::from_secs(5), "seq {:?}", seq_elapsed);
    assert!(par_elapsed < Duration::from_secs(5), "par {:?}", par_elapsed);
}

#[test]
fn parallel_threshold_constant_is_documented() {
    assert_eq!(PARALLEL_SCAN_THRESHOLD, 50);
    assert!(!dslinter::scan_pipeline::should_scan_parallel(false, 49));
    assert!(dslinter::scan_pipeline::should_scan_parallel(false, 50));
    assert!(dslinter::scan_pipeline::should_scan_parallel(true, 1));
}
