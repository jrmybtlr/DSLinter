use std::path::PathBuf;

#[test]
fn demo_workspace_has_inventory_and_rules() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("demo/react");
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
    assert_eq!(report.schema_version, 3);
    assert!(
        report.css_tokens.is_some(),
        "demo should emit css_tokens from stylesheets"
    );
    // Token-aware rules: theme-matching danger red should not be flagged; off-theme hex should.
    assert!(
        !report.findings.iter().any(|f| {
            f.rule_id == "token-hardcoded-color" && f.message.contains("#dc2626")
        }),
        "PromoBanner danger color matches --color-danger and should pass"
    );
    assert!(
        report.findings.iter().any(|f| {
            f.rule_id == "token-hardcoded-color" && f.message.contains("#ff0066")
        }),
        "FlashBanner off-theme hex should still flag"
    );
    // Custom non-scale spacing should not trigger arbitrary size findings.
    assert!(
        !report.findings.iter().any(|f| {
            f.rule_id == "token-tailwind-arbitrary" && f.message.contains("13px")
        }),
        "ChaosGrid gap-[13px] is a custom size and should pass"
    );
}
