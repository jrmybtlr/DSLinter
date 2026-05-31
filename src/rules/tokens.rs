//! Token color and Tailwind arbitrary-value rules.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::config::DslintConfig;
use crate::model::{FileScan, LintFinding, Severity};
use crate::rules::extracts::{for_each_ast_text, for_each_source_regex};
use crate::util::regex::{hex_re, tw_arbitrary_re};

fn tailwind_arbitrary_in_text(path: &Path, line: u32, text: &str) -> Vec<LintFinding> {
    let re = tw_arbitrary_re();
    re.find_iter(text)
        .map(|m| {
            LintFinding::new(
                "token-tailwind-arbitrary",
                path.to_path_buf(),
                Some(line),
                Severity::Info,
                format!("Tailwind arbitrary value `{}`", m.as_str()),
            )
        })
        .collect()
}

pub fn tailwind_arbitrary_tokens(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
) -> Vec<LintFinding> {
    let mut out = Vec::new();
    let mut push = |path: &Path, line: u32, text: &str| {
        out.extend(tailwind_arbitrary_in_text(path, line, text));
    };
    for_each_ast_text(files, |path, line, text| {
        if tw_arbitrary_re().is_match(text) {
            push(path, line, text);
        }
    });
    for_each_source_regex(files, sources, tw_arbitrary_re, &mut push);
    out
}

/// When Tailwind arbitrary brackets contain a hex (`[#rgb]`), both `token-tailwind-arbitrary` and
/// `token-hardcoded-color` can fire on the same line — keep the Tailwind rule only.
pub fn dedupe_token_color_overlap(findings: &mut Vec<LintFinding>) {
    let tw_lines: HashSet<(PathBuf, u32)> = findings
        .iter()
        .filter(|f| f.rule_id == "token-tailwind-arbitrary")
        .filter_map(|f| f.line.map(|ln| (f.path.clone(), ln)))
        .collect();
    findings.retain(|f| {
        f.rule_id != "token-hardcoded-color"
            || f.line.map_or(true, |ln| !tw_lines.contains(&(f.path.clone(), ln)))
    });
}

pub fn deprecated_usage(files: &[FileScan], config: &DslintConfig) -> Vec<LintFinding> {
    use std::collections::HashSet;

    let banned: HashSet<_> = config.deprecated_components.iter().cloned().collect();
    if banned.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for file in files {
        for u in &file.usages {
            if banned.contains(&u.component) {
                out.push(LintFinding::new(
                    "deprecated-component",
                    file.path.clone(),
                    Some(u.line),
                    Severity::Warning,
                    format!(
                        "Deprecated component `{}` is still referenced.",
                        u.component
                    ),
                ));
            }
        }
    }
    out
}

fn hex_color_findings_in_text(path: &Path, line: u32, text: &str) -> Vec<LintFinding> {
    hex_re()
        .find_iter(text)
        .map(|m| {
            LintFinding::new(
                "token-hardcoded-color",
                path.to_path_buf(),
                Some(line),
                Severity::Info,
                format!("Hardcoded color `{}`", m.as_str()),
            )
        })
        .collect()
}

pub fn hardcoded_hex_colors(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
) -> Vec<LintFinding> {
    let mut out = Vec::new();
    let mut push = |path: &Path, line: u32, text: &str| {
        out.extend(hex_color_findings_in_text(path, line, text));
    };
    for_each_ast_text(files, |path, line, text| {
        if hex_re().is_match(text) {
            push(path, line, text);
        }
    });
    for_each_source_regex(files, sources, hex_re, &mut push);
    out
}

#[cfg(test)]
mod token_ast_tests {
    use super::*;
    use crate::ecma::analyze_ecma_file;
    use std::path::Path;

    #[test]
    fn hex_in_comment_not_reported_via_ast() {
        let path = Path::new("token_ast_comment.tsx");
        let src = r#"
// #ffffff should not be a finding
export function Box() {
  return <div className="ok">x</motion.div>;
}
"#;
        let file = analyze_ecma_file(path, src);
        let mut sources = HashMap::new();
        sources.insert(path.to_path_buf(), src.to_string());
        let findings = hardcoded_hex_colors(std::slice::from_ref(&file), &sources);
        assert!(
            findings.is_empty(),
            "comment hex should not appear in AST literals: {:?}",
            findings
        );
    }

    #[test]
    fn hex_in_string_literal_reported_via_ast() {
        let path = Path::new("token_ast_literal.tsx");
        let src = r##"
export function Box() {
  const c = "#ff00aa";
  return null;
}
"##;
        let file = analyze_ecma_file(path, src);
        let mut sources = HashMap::new();
        sources.insert(path.to_path_buf(), src.to_string());
        let findings = hardcoded_hex_colors(std::slice::from_ref(&file), &sources);
        assert!(
            findings.iter().any(|f| f.message.contains("#ff00aa")),
            "expected hex in string literal: {:?}",
            findings
        );
    }
}

#[cfg(test)]
mod dedupe_tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn dedupe_drops_hex_when_arbitrary_on_same_line() {
        let p = PathBuf::from("x.tsx");
        let mut findings = vec![
            LintFinding::new(
                "token-hardcoded-color",
                p.clone(),
                Some(10),
                Severity::Info,
                "hex",
            ),
            LintFinding::new(
                "token-tailwind-arbitrary",
                p.clone(),
                Some(10),
                Severity::Info,
                "arb",
            ),
            LintFinding::new(
                "token-hardcoded-color",
                p.clone(),
                Some(11),
                Severity::Info,
                "hex2",
            ),
        ];
        dedupe_token_color_overlap(&mut findings);
        assert_eq!(findings.len(), 2);
        assert!(findings
            .iter()
            .any(|f| f.rule_id == "token-tailwind-arbitrary"));
        assert_eq!(
            findings
                .iter()
                .filter(|f| f.rule_id == "token-hardcoded-color")
                .count(),
            1
        );
        assert!(findings.iter().any(|f| f.line == Some(11)));
    }
}
