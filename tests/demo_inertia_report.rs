use std::path::PathBuf;

#[test]
fn demo_inertia_report_stays_bounded_and_captures_implementation_classes() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("demo/inertia");
    let report = dslinter::scan_workspace(&root).expect("scan demo/inertia");
    let json = dslinter::report::report_to_json(&report).expect("serialize report");

    assert!(
        json.len() < 5_000_000,
        "report unexpectedly large ({} bytes) — check css_tokens scope",
        json.len()
    );

    let appearance = report
        .files
        .iter()
        .flat_map(|f| f.definitions.iter())
        .find(|d| d.name == "AppearanceToggleTab")
        .expect("AppearanceToggleTab definition");

    assert!(
        appearance
            .implementation_class_frequencies
            .get("ml-1.5")
            .copied()
            .unwrap_or(0)
            >= 1,
        "expected ml-1.5 from span className: {:?}",
        appearance.implementation_class_frequencies
    );
}
