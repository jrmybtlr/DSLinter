//! Code-quality rule config filtering and `smell-*` / `code-*` aliases.

use crate::config::DslintConfig;
use crate::model::LintFinding;
use crate::util::rule_match::rule_matches_pattern;

pub fn is_code_quality_rule(rule_id: &str) -> bool {
    rule_id.starts_with("code-") || rule_id.starts_with("smell-")
}

/// `smell-*` config entries also match `code-*` rule ids (and vice versa).
fn code_rule_aliases(rule_id: &str) -> Vec<String> {
    if let Some(suffix) = rule_id.strip_prefix("code-") {
        vec![rule_id.to_string(), format!("smell-{suffix}")]
    } else if let Some(suffix) = rule_id.strip_prefix("smell-") {
        vec![rule_id.to_string(), format!("code-{suffix}")]
    } else {
        vec![rule_id.to_string()]
    }
}

pub fn filter_code_quality_config(
    mut findings: Vec<LintFinding>,
    config: &DslintConfig,
) -> Vec<LintFinding> {
    findings.retain(|f| {
        if (f.rule_id == "code-console-error" || f.rule_id == "smell-console-error")
            && !config.code_quality.report_console_error
        {
            return false;
        }
        if is_code_quality_rule(&f.rule_id) {
            let aliases = code_rule_aliases(&f.rule_id);
            return !config
                .code_quality
                .disabled_rules
                .iter()
                .any(|pat| aliases.iter().any(|id| rule_matches_pattern(id, pat)));
        }
        true
    });
    findings
}
