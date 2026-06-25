use std::path::PathBuf;

#[test]
fn demo_workspace_discovers_css_tokens() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("demo/react");
    let report = dslinter::scan_workspace(&root).expect("scan demo");
    let summary = report
        .css_tokens
        .as_ref()
        .expect("expected css_tokens in demo report");
    assert!(
        !summary.definitions.is_empty(),
        "expected CSS token definitions from index.css + dslinter/theme.css"
    );
    assert!(
        summary
            .definitions
            .iter()
            .any(|d| d.name.starts_with("--color-")),
        "expected theme color tokens"
    );
    assert!(
        summary.usage_by_token.iter().any(|u| u.reference_count > 0),
        "expected at least one token usage in demo components"
    );
}
