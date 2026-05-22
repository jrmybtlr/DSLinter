//! `// dslint-ignore-next-line rule-id,...` and block suppressions.

use std::collections::HashMap;

use crate::model::LintFinding;
use crate::util::rule_match::rule_suppressed_by_patterns;

fn parse_ignore_comment(line: &str) -> Option<Vec<String>> {
    let trimmed = line.trim();
    let prefix = "// dslint-ignore-next-line";
    let prefix_block = "/* dslint-ignore-next-line";
    let rest = if let Some(r) = trimmed.strip_prefix(prefix) {
        r.trim()
    } else if let Some(r) = trimmed.strip_prefix(prefix_block) {
        r.trim().trim_end_matches("*/").trim()
    } else {
        return None;
    };
    if rest.is_empty() {
        return Some(vec!["*".to_string()]);
    }
    Some(
        rest.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
    )
}

/// Drops findings whose preceding source line requests suppression.
///
/// Precomputes a `Vec<&str>` of lines for each source file so that each
/// per-finding lookup is O(1) rather than O(source_len).
pub fn apply_inline_suppressions(
    findings: Vec<LintFinding>,
    sources: &HashMap<std::path::PathBuf, String>,
) -> Vec<LintFinding> {
    let line_cache: HashMap<&std::path::PathBuf, Vec<&str>> = sources
        .iter()
        .map(|(k, v)| (k, v.lines().collect()))
        .collect();

    findings
        .into_iter()
        .filter(|f| {
            let Some(ln) = f.line else {
                return true;
            };
            let Some(lines) = line_cache.get(&f.path) else {
                return true;
            };
            let prev_line = ln.saturating_sub(1);
            if prev_line == 0 {
                return true;
            }
            let Some(prev) = lines.get((prev_line - 1) as usize) else {
                return true;
            };
            let Some(patterns) = parse_ignore_comment(prev) else {
                return true;
            };
            !rule_suppressed_by_patterns(&f.rule_id, &patterns)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn suppresses_next_line() {
        let src = "// dslint-ignore-next-line foo\nconst x = 1;\n";
        let mut m = HashMap::new();
        m.insert(PathBuf::from("a.ts"), src.to_string());
        let findings = vec![LintFinding::new(
            "foo",
            PathBuf::from("a.ts"),
            Some(2),
            crate::model::Severity::Warning,
            "m",
        )];
        let out = apply_inline_suppressions(findings, &m);
        assert!(out.is_empty());
    }
}
