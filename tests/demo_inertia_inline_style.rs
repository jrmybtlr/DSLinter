use std::path::PathBuf;

#[test]
fn two_factor_modal_filter_style_not_inline_style_finding() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("demo/inertia");
    let report = dslinter::scan_workspace(&root).expect("scan demo/inertia");
    let path_suffix = "two-factor-setup-modal.tsx";
    let modal_findings: Vec<_> = report
        .findings
        .iter()
        .filter(|f| f.path.to_string_lossy().contains(path_suffix))
        .map(|f| (&f.rule_id, f.line))
        .collect();
    let inline_style: Vec<_> = modal_findings
        .iter()
        .filter(|(rule, _)| *rule == &"code-inline-style")
        .collect();
    assert!(
        inline_style.is_empty(),
        "filter-only inline style should not trigger code-inline-style; all modal findings: {:?}",
        modal_findings
    );
}

#[test]
fn demo_inertia_inline_style_only_flags_off_theme_colors() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("demo/inertia");
    let report = dslinter::scan_workspace(&root).expect("scan demo/inertia");
    let inline_style: Vec<_> = report
        .findings
        .iter()
        .filter(|f| f.rule_id == "code-inline-style")
        .map(|f| (f.path.display().to_string(), f.line))
        .collect();
    for (path, line) in &inline_style {
        assert!(
            !path.contains("two-factor-setup-modal"),
            "unexpected code-inline-style at {path}:{line:?}: {inline_style:?}"
        );
    }
}

/// Regenerate `demo/inertia/public/dslinter-report.json` after rule changes.
#[test]
#[ignore]
fn refresh_demo_inertia_report() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("demo/inertia");
    let report = dslinter::scan_workspace(&root).expect("scan demo/inertia");
    let json = dslinter::report::report_to_json(&report).expect("json");
    let output = root.join("public/dslinter-report.json");
    std::fs::write(&output, json).expect("write report");
}
