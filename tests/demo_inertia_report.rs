use std::path::PathBuf;

#[test]
fn demo_inertia_report_stays_bounded() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("demo/inertia");
    let report = dslinter::scan_workspace(&root).expect("scan demo/inertia");
    let json = dslinter::report::report_to_json(&report).expect("serialize report");

    assert!(
        json.len() < 5_000_000,
        "report unexpectedly large ({} bytes) — check css_tokens scope",
        json.len()
    );

    assert!(
        report
            .files
            .iter()
            .flat_map(|f| f.definitions.iter())
            .any(|d| d.name == "AppearanceToggleTab"),
        "expected AppearanceToggleTab definition in demo/inertia scan"
    );
}
