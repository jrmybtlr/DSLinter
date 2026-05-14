//! `// dslint-ignore-next-line rule-id,...` and block suppressions.

use std::collections::HashMap;
use std::path::Path;

use crate::model::LintFinding;

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

fn rule_suppressed_by_patterns(rule_id: &str, patterns: &[String]) -> bool {
    for p in patterns {
        if p == "*" {
            return true;
        }
        if p.ends_with('*') && !p.starts_with('*') {
            let pre = &p[..p.len() - 1];
            if rule_id.starts_with(pre) {
                return true;
            }
        } else if p == rule_id {
            return true;
        }
    }
    false
}

/// Drops findings whose preceding source line requests suppression.
///
/// Precomputes a `Vec<&str>` of lines for each source file so that each
/// per-finding lookup is O(1) rather than O(source_len).
pub fn apply_inline_suppressions(
    findings: Vec<LintFinding>,
    sources: &HashMap<std::path::PathBuf, String>,
) -> Vec<LintFinding> {
    // Precompute line vectors once per source file (O(n) build, O(1) lookup).
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
            // Line numbers are 1-indexed; prev_line is already (ln - 1).
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

pub fn collect_workspace_sources(
    _root: &Path,
    files: &[crate::model::FileScan],
) -> HashMap<std::path::PathBuf, String> {
    let mut map = HashMap::new();
    for f in files {
        if map.contains_key(&f.path) {
            continue;
        }
        if let Ok(s) = std::fs::read_to_string(&f.path) {
            map.insert(f.path.clone(), s);
        }
    }
    map
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
        let findings = vec![LintFinding {
            rule_id: "foo".into(),
            message: "m".into(),
            path: PathBuf::from("a.ts"),
            line: Some(2),
            severity: crate::model::Severity::Warning,
        }];
        let out = apply_inline_suppressions(findings, &m);
        assert!(out.is_empty());
    }
}
