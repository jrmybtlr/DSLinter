use std::path::PathBuf;

#[test]
fn demo_workspace_has_inventory_and_rules() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("demo");
    let report = dslinter::scan_workspace(&root).expect("scan demo");
    assert!(
        !report.files.is_empty(),
        "expected demo sources under {}",
        root.display()
    );
    assert!(
        report
            .findings
            .iter()
            .any(|f| f.rule_id.starts_with("a11y-")),
        "expected at least one a11y finding in shaped demo"
    );
    assert!(
        !report.ownership.is_empty(),
        "ownership rollup should include at least one bucket"
    );
}
