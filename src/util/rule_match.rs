//! Shared rule-id glob matching (`*`, `prefix*`, exact).

pub fn rule_matches_pattern(rule_id: &str, pattern: &str) -> bool {
    if pattern == "*" {
        return true;
    }
    if let Some(prefix) = pattern.strip_suffix('*') {
        return rule_id.starts_with(prefix);
    }
    pattern == rule_id
}

pub fn rule_suppressed_by_patterns(rule_id: &str, patterns: &[String]) -> bool {
    patterns
        .iter()
        .any(|p| rule_matches_pattern(rule_id, p))
}
