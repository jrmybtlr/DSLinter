//! Token color and Tailwind arbitrary-value rules.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::config::DslintConfig;
use crate::model::{FileScan, LintFinding, Severity};
use crate::rules::extracts::{for_each_ast_text, for_each_class_string, for_each_source_regex, for_each_style_color_value};
use crate::token_values::{
    find_arbitrary_utilities_in_text, find_hardcoded_colors_in_text, is_color_utility_prefix,
    is_size_utility_prefix, parse_css_color, ColorAllowlist, SizeScale,
};
use crate::util::regex::{hex_re, tw_arbitrary_re};

fn tailwind_arbitrary_in_class_text(
    path: &Path,
    line: u32,
    text: &str,
    color_allowlist: Option<&ColorAllowlist>,
    size_scale: &SizeScale,
) -> Vec<LintFinding> {
    let mut out = Vec::new();
    for (prefix, arbitrary) in find_arbitrary_utilities_in_text(text) {
        if is_size_utility_prefix(&prefix) {
            if let Some(suggested) = size_scale.match_size_utility(&prefix, &arbitrary) {
                out.push(LintFinding::new(
                    "token-tailwind-arbitrary",
                    path.to_path_buf(),
                    Some(line),
                    Severity::Info,
                    format!(
                        "Use `{suggested}` instead of arbitrary `{prefix}-[{arbitrary}]`"
                    ),
                ));
            }
            continue;
        }

        if is_color_utility_prefix(&prefix) {
            let bracket = format!("[{arbitrary}]");
            if arbitrary.starts_with('#') {
                if color_allowlist.is_some_and(|a| a.is_allowed(&arbitrary)) {
                    continue;
                }
                out.push(LintFinding::new(
                    "token-tailwind-arbitrary",
                    path.to_path_buf(),
                    Some(line),
                    Severity::Info,
                    format!("Tailwind arbitrary value `{bracket}`"),
                ));
            }
        }
    }
    out
}

pub fn tailwind_arbitrary_tokens(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
    color_allowlist: Option<&ColorAllowlist>,
    size_scale: &SizeScale,
) -> Vec<LintFinding> {
    let mut out = Vec::new();
    let mut push_class = |path: &Path, line: u32, text: &str| {
        out.extend(tailwind_arbitrary_in_class_text(
            path,
            line,
            text,
            color_allowlist,
            size_scale,
        ));
    };

    for_each_class_string(files, sources, &mut push_class);

    // Regex fallback for unparseable files: legacy bracket scan with same logic on class-like snippets.
    for_each_source_regex(files, sources, tw_arbitrary_re, |path, line, matched| {
        if let Some(arbitrary) = matched.strip_prefix('[').and_then(|s| s.strip_suffix(']')) {
            if arbitrary.starts_with('#') {
                if color_allowlist.is_some_and(|a| a.is_allowed(arbitrary)) {
                    return;
                }
                out.push(LintFinding::new(
                    "token-tailwind-arbitrary",
                    path.to_path_buf(),
                    Some(line),
                    Severity::Info,
                    format!("Tailwind arbitrary value `{matched}`"),
                ));
            } else if parse_css_color(arbitrary).is_none() {
                // px/rem without utility context — skip on fallback (no prefix available).
            }
        }
    });

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

fn hex_color_findings_in_text(
    path: &Path,
    line: u32,
    text: &str,
    color_allowlist: Option<&ColorAllowlist>,
) -> Vec<LintFinding> {
    find_hardcoded_colors_in_text(text, color_allowlist)
        .into_iter()
        .map(|hex| {
            let token_hint = color_allowlist
                .and_then(|a| a.token_for_color(&hex))
                .map(|t| format!(" — use token `{t}`"))
                .unwrap_or_default();
            LintFinding::new(
                "token-hardcoded-color",
                path.to_path_buf(),
                Some(line),
                Severity::Info,
                format!("Hardcoded color `{hex}` — no matching design token{token_hint}"),
            )
        })
        .collect()
}

pub fn hardcoded_hex_colors(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
    color_allowlist: Option<&ColorAllowlist>,
) -> Vec<LintFinding> {
    let mut out = Vec::new();
    let mut push = |path: &Path, line: u32, text: &str| {
        if hex_re().is_match(text) || text.contains("rgb(") {
            out.extend(hex_color_findings_in_text(path, line, text, color_allowlist));
        }
    };
    for_each_ast_text(files, |path, line, text| push(path, line, text));
    for_each_style_color_value(files, |path, line, text| push(path, line, text));
    for_each_source_regex(files, sources, hex_re, &mut push);
    out
}

#[cfg(test)]
mod token_ast_tests {
    use super::*;
    use crate::ecma::analyze_ecma_file;
    use crate::model::{
        CssTokenCategory, CssTokenDefinition, CssTokenScope, CssTokenSummary,
    };
    use crate::token_values::{ColorAllowlist, SizeScale};
    use std::path::Path;

    fn danger_allowlist() -> ColorAllowlist {
        let summary = CssTokenSummary {
            definitions: vec![CssTokenDefinition {
                name: "--color-danger".to_string(),
                value: "#dc2626".to_string(),
                category: CssTokenCategory::Color,
                scope: CssTokenScope::Theme,
                path: PathBuf::from("theme.css"),
                line: 1,
            }],
            usage_by_token: vec![],
            unused_tokens: vec![],
        };
        ColorAllowlist::from_css_tokens(&summary)
    }

    #[test]
    fn hex_in_comment_not_reported_via_ast() {
        let path = Path::new("token_ast_comment.tsx");
        let src = r#"
// #ffffff should not be a finding
export function Box() {
  return <div className="ok">x</div>;
}
"#;
        let file = analyze_ecma_file(path, src);
        let mut sources = HashMap::new();
        sources.insert(path.to_path_buf(), src.to_string());
        let findings = hardcoded_hex_colors(std::slice::from_ref(&file), &sources, None);
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
        let findings = hardcoded_hex_colors(std::slice::from_ref(&file), &sources, None);
        assert!(
            findings.iter().any(|f| f.message.contains("#ff00aa")),
            "expected hex in string literal: {:?}",
            findings
        );
    }

    #[test]
    fn theme_color_allowed_everywhere() {
        let path = Path::new("promo.tsx");
        let src = r##"
export function Promo() {
  return <div style={{ backgroundColor: "#dc2626" }} className="text-[#dc2626]" />;
}
"##;
        let file = analyze_ecma_file(path, src);
        let mut sources = HashMap::new();
        sources.insert(path.to_path_buf(), src.to_string());
        let allow = danger_allowlist();
        let color_findings =
            hardcoded_hex_colors(std::slice::from_ref(&file), &sources, Some(&allow));
        assert!(
            color_findings.is_empty(),
            "theme-matching colors should pass: {:?}",
            color_findings
        );
        let scale = SizeScale::default_tailwind();
        let arb = tailwind_arbitrary_tokens(
            std::slice::from_ref(&file),
            &sources,
            Some(&allow),
            &scale,
        );
        assert!(
            arb.is_empty(),
            "theme-matching arbitrary colors should pass: {:?}",
            arb
        );
    }

    #[test]
    fn off_theme_hex_still_flagged() {
        let path = Path::new("flash.tsx");
        let src = r##"
export function Flash() {
  return <div style={{ backgroundColor: "#ff0066" }} />;
}
"##;
        let file = analyze_ecma_file(path, src);
        let mut sources = HashMap::new();
        sources.insert(path.to_path_buf(), src.to_string());
        let allow = danger_allowlist();
        let findings =
            hardcoded_hex_colors(std::slice::from_ref(&file), &sources, Some(&allow));
        assert!(
            findings.iter().any(|f| f.message.contains("#ff0066")),
            "off-theme hex should flag: {:?}",
            findings
        );
    }

    #[test]
    fn arbitrary_size_matches_scale_only() {
        let path = Path::new("sizes.tsx");
        let src = r#"
export function Grid() {
  return <div className="w-[80px] gap-[13px] shadow-[0_1px_2px]" />;
}
"#;
        let file = analyze_ecma_file(path, src);
        let mut sources = HashMap::new();
        sources.insert(path.to_path_buf(), src.to_string());
        let scale = SizeScale::default_tailwind();
        let findings = tailwind_arbitrary_tokens(
            std::slice::from_ref(&file),
            &sources,
            None,
            &scale,
        );
        assert!(
            findings
                .iter()
                .any(|f| f.message.contains("w-20") && f.message.contains("w-[80px]")),
            "scale-matching size should suggest utility: {:?}",
            findings
        );
        assert!(
            !findings.iter().any(|f| f.message.contains("13px")),
            "custom non-scale sizes should pass: {:?}",
            findings
        );
        assert!(
            !findings.iter().any(|f| f.message.contains("shadow")),
            "non-size arbitraries should pass: {:?}",
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
