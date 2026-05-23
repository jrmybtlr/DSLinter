//! Tailwind dark-mode contrast heuristics.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::config::DslintConfig;
use crate::model::{FileScan, LintFinding, Severity};
use crate::rules::extracts::for_each_class_string;

fn is_probable_color_utility(rest: &str, non_color_words: &[&str]) -> bool {
    if rest.is_empty() {
        return false;
    }
    if rest.starts_with('[') {
        return true;
    }
    !non_color_words.contains(&rest)
}

fn is_probable_text_color_class(token: &str) -> bool {
    let Some(rest) = token.strip_prefix("text-") else {
        return false;
    };
    const NON_COLOR_TEXT: &[&str] = &[
        "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
        "left", "center", "right", "justify", "start", "end", "ellipsis", "clip", "balance",
        "pretty", "wrap", "nowrap",
    ];
    is_probable_color_utility(rest, NON_COLOR_TEXT)
}

fn is_probable_bg_color_class(token: &str) -> bool {
    let Some(rest) = token.strip_prefix("bg-") else {
        return false;
    };
    const NON_COLOR_BG_KEYS: &[&str] = &[
        "clip", "origin", "blend", "gradient", "repeat", "no-repeat", "fixed", "local", "scroll",
        "center", "top", "bottom", "left", "right", "cover", "contain", "none", "auto",
    ];
    if NON_COLOR_BG_KEYS
        .iter()
        .any(|key| rest == *key || rest.starts_with(&format!("{key}-")))
    {
        return false;
    }
    is_probable_color_utility(rest, &[])
}

fn token_has_dark_variant(token: &str) -> bool {
    token.split(':').any(|segment| segment == "dark")
}

fn utility_segment(token: &str) -> &str {
    token.rsplit(':').next().unwrap_or(token)
}

fn has_dark_mode_contrast_issue(classes: &str) -> bool {
    let mut has_text_color = false;
    let mut has_bg_color = false;
    let mut has_dark_color_variant = false;

    for token in classes.split_whitespace() {
        let utility = utility_segment(token);
        let utility_is_text = is_probable_text_color_class(utility);
        let utility_is_bg = is_probable_bg_color_class(utility);
        if utility_is_text {
            has_text_color = true;
        }
        if utility_is_bg {
            has_bg_color = true;
        }
        if token_has_dark_variant(token) && (utility_is_text || utility_is_bg) {
            has_dark_color_variant = true;
        }
    }

    has_text_color && has_bg_color && !has_dark_color_variant
}

fn dark_mode_contrast_message() -> &'static str {
    "Class tokens set text/background colors without an explicit `dark:` color variant; verify dark-mode contrast or disable this check in `.dslint.json`."
}

fn push_dark_mode_finding(out: &mut Vec<LintFinding>, path: &Path, line: u32) {
    out.push(LintFinding::new(
        "a11y-dark-mode-contrast",
        path.to_path_buf(),
        Some(line),
        Severity::Info,
        dark_mode_contrast_message(),
    ));
}

pub fn dark_mode_contrast_findings(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
    config: &DslintConfig,
) -> Vec<LintFinding> {
    if !config.check_dark_mode_contrast {
        return Vec::new();
    }

    let mut out = Vec::new();
    for_each_class_string(files, sources, |path, line, classes| {
        if has_dark_mode_contrast_issue(classes) {
            push_dark_mode_finding(&mut out, path, line);
        }
    });
    out
}

#[cfg(test)]
mod dark_mode_contrast_tests {
    use super::*;
    use crate::model::FileScan;
    use std::path::PathBuf;

    fn file(path: &str) -> FileScan {
        FileScan::empty(PathBuf::from(path))
    }

    #[test]
    fn dark_mode_contrast_off_by_default() {
        let files = vec![file("x.tsx")];
        let mut sources = HashMap::new();
        sources.insert(
            PathBuf::from("x.tsx"),
            r#"<div className="bg-slate-100 text-slate-900" />"#.to_string(),
        );
        let config = DslintConfig::default();
        let findings = dark_mode_contrast_findings(&files, &sources, &config);
        assert!(findings.is_empty(), "{findings:?}");
    }

    #[test]
    fn dark_mode_contrast_flags_missing_dark_variant() {
        let files = vec![file("x.tsx")];
        let mut sources = HashMap::new();
        sources.insert(
            PathBuf::from("x.tsx"),
            r#"<div className="bg-slate-100 text-slate-900" />"#.to_string(),
        );
        let config = DslintConfig {
            check_dark_mode_contrast: true,
            ..Default::default()
        };
        let findings = dark_mode_contrast_findings(&files, &sources, &config);
        assert!(
            findings
                .iter()
                .any(|f| f.rule_id == "a11y-dark-mode-contrast"),
            "{findings:?}"
        );
    }

    #[test]
    fn dark_mode_contrast_skips_when_dark_variant_present() {
        let files = vec![file("x.tsx")];
        let mut sources = HashMap::new();
        sources.insert(
            PathBuf::from("x.tsx"),
            r#"<div className="bg-slate-100 text-slate-900 dark:bg-slate-900" />"#.to_string(),
        );
        let config = DslintConfig {
            check_dark_mode_contrast: true,
            ..Default::default()
        };
        let findings = dark_mode_contrast_findings(&files, &sources, &config);
        assert!(findings.is_empty(), "{findings:?}");
    }

    #[test]
    fn dark_mode_contrast_skips_when_dark_variant_is_chained() {
        let files = vec![file("x.tsx")];
        let mut sources = HashMap::new();
        sources.insert(
            PathBuf::from("x.tsx"),
            r#"<div className="bg-slate-100 text-slate-900 md:dark:bg-slate-900" />"#.to_string(),
        );
        let config = DslintConfig {
            check_dark_mode_contrast: true,
            ..Default::default()
        };
        let findings = dark_mode_contrast_findings(&files, &sources, &config);
        assert!(findings.is_empty(), "{findings:?}");
    }

    #[test]
    fn dark_mode_contrast_reads_cn_quoted_literals() {
        let files = vec![file("x.tsx")];
        let mut sources = HashMap::new();
        sources.insert(
            PathBuf::from("x.tsx"),
            r#"<div className={cn("bg-slate-100", "text-slate-900")} />"#.to_string(),
        );
        let config = DslintConfig {
            check_dark_mode_contrast: true,
            ..Default::default()
        };
        let findings = dark_mode_contrast_findings(&files, &sources, &config);
        assert!(
            findings
                .iter()
                .any(|f| f.rule_id == "a11y-dark-mode-contrast"),
            "{findings:?}"
        );
    }

    #[test]
    fn dark_mode_contrast_does_not_miss_custom_bg_color_prefixes() {
        let files = vec![file("x.tsx")];
        let mut sources = HashMap::new();
        sources.insert(
            PathBuf::from("x.tsx"),
            r#"<div className="bg-topaz-500 text-slate-900" />"#.to_string(),
        );
        let config = DslintConfig {
            check_dark_mode_contrast: true,
            ..Default::default()
        };
        let findings = dark_mode_contrast_findings(&files, &sources, &config);
        assert!(
            findings
                .iter()
                .any(|f| f.rule_id == "a11y-dark-mode-contrast"),
            "{findings:?}"
        );
    }
}
