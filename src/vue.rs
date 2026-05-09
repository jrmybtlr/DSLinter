//! Vue single-file component extraction (template usages + script definitions).

use std::path::Path;

use regex::Regex;

use crate::ecma::analyze_ecma_for_paths;
use crate::model::{FileScan, JsxUsage, LintFinding, Severity};
use crate::smells;

/// Captures `<script ...>...</script>` blocks (non-greedy inner content).
fn script_block_regex() -> Regex {
    Regex::new(r#"(?si)<script([^>]*)>(.*?)</script>"#).expect("script regex")
}

fn template_block_regex() -> Regex {
    Regex::new(r#"(?si)<template(?:\s[^>]*)?>(.*?)</template>"#).expect("template regex")
}

fn lang_is_ts(attrs: &str) -> bool {
    attrs.contains("lang=\"ts\"")
        || attrs.contains("lang='ts'")
        || attrs.contains("lang=\"tsx\"")
        || attrs.contains("lang='tsx'")
}

fn line_at(full_source: &str, byte_offset: usize) -> u32 {
    1 + full_source[..byte_offset.min(full_source.len())]
        .bytes()
        .filter(|&b| b == b'\n')
        .count() as u32
}

/// Template-only accessibility checks (HTML in `<template>`).
fn vue_template_a11y_findings(
    path: &Path,
    full_source: &str,
    template: &str,
    template_inner_start: usize,
) -> Vec<LintFinding> {
    let mut out = Vec::new();

    let img_re = Regex::new(r#"(?si)<img\s([^>]*?)\s*/?>"#).expect("vue img regex");
    for cap in img_re.captures_iter(template) {
        let attrs = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        if attrs.to_ascii_lowercase().contains("alt=") {
            continue;
        }
        let pos = template_inner_start + cap.get(0).unwrap().start();
        out.push(LintFinding {
            rule_id: "a11y-img-alt".into(),
            message: "`<img>` must include an `alt` attribute (empty string is OK for decorative images)."
                .into(),
            path: path.to_path_buf(),
            line: Some(line_at(full_source, pos)),
            severity: Severity::Warning,
        });
    }

    let a_open = Regex::new(r#"(?si)<a(\s[^>]*)?>"#).expect("vue anchor regex");
    for cap in a_open.captures_iter(template) {
        let attrs = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let lower = attrs.to_ascii_lowercase();
        let pos = template_inner_start + cap.get(0).unwrap().start();
        let line = line_at(full_source, pos);

        if !lower.contains("href=") {
            out.push(LintFinding {
                rule_id: "a11y-anchor-href".into(),
                message: "`<a>` must have a meaningful `href` for navigation.".into(),
                path: path.to_path_buf(),
                line: Some(line),
                severity: Severity::Warning,
            });
            continue;
        }

        let bad_href = lower.contains("href=\"#\"")
            || lower.contains("href='#'")
            || lower.contains("href=\"\"")
            || lower.contains("href=''")
            || lower.contains("javascript:");
        if bad_href {
            out.push(LintFinding {
                rule_id: "a11y-anchor-placeholder-href".into(),
                message: "Avoid empty `href`, `href=\"#\"`, or `javascript:` URLs without accessible behavior."
                    .into(),
                path: path.to_path_buf(),
                line: Some(line),
                severity: Severity::Warning,
            });
        }
    }

    let input_re = Regex::new(r#"(?si)<input\s([^>]*?)\s*/?>"#).expect("vue input regex");
    for cap in input_re.captures_iter(template) {
        let attrs = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let lower = attrs.to_ascii_lowercase();
        if lower.contains("type=")
            && (lower.contains("type=\"hidden\"")
                || lower.contains("type='hidden'")
                || lower.contains("type=hidden"))
        {
            continue;
        }
        if lower.contains("aria-label=") || lower.contains("aria-labelledby=") {
            continue;
        }
        let pos = template_inner_start + cap.get(0).unwrap().start();
        out.push(LintFinding {
            rule_id: "a11y-input-label".into(),
            message: "`<input>` should expose an accessible name (`aria-label`, `aria-labelledby`, or associated `<label>`)."
                .into(),
            path: path.to_path_buf(),
            line: Some(line_at(full_source, pos)),
            severity: Severity::Info,
        });
    }

    out
}

/// Shift 1-based line numbers from combined `<script>` text to full `.vue` file positions.
fn fixup_vue_script_line_offsets(scan: &mut FileScan, vue_source: &str) {
    let script_re = script_block_regex();
    let caps: Vec<_> = script_re.captures_iter(vue_source).collect();
    if caps.len() != 1 {
        return;
    }
    let Some(inner) = caps[0].get(2) else {
        return;
    };
    let line_offset = vue_source[..inner.start()]
        .bytes()
        .filter(|&b| b == b'\n')
        .count() as u32;

    for d in &mut scan.definitions {
        d.line += line_offset;
    }
    for u in &mut scan.usages {
        u.line += line_offset;
    }
    for f in &mut scan.findings {
        if let Some(ln) = f.line.as_mut() {
            *ln += line_offset;
        }
    }
}

/// Merge Vue template component references into an ECMA analysis of the `<script>` blocks.
pub fn analyze_vue_file(path: &Path, source: &str) -> FileScan {
    let script_re = script_block_regex();
    let mut combined_script = String::new();
    for cap in script_re.captures_iter(source) {
        let inner = cap.get(2).map(|m| m.as_str()).unwrap_or("");
        combined_script.push_str(inner);
        combined_script.push('\n');
    }

    let pseudo_path = if lang_is_ts(
        script_re
            .captures(source)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str())
            .unwrap_or(""),
    ) || source.contains("lang=\"ts\"")
        || source.contains("lang='ts'")
    {
        path.with_extension("tsx")
    } else {
        path.with_extension("jsx")
    };

    let mut scan = if combined_script.trim().is_empty() {
        FileScan {
            path: path.to_path_buf(),
            definitions: Vec::new(),
            usages: Vec::new(),
            parse_errors: vec!["dslint: Vue SFC has no <script> block".into()],
            findings: Vec::new(),
        }
    } else {
        analyze_ecma_for_paths(path, &pseudo_path, &combined_script, false)
    };
    scan.path = path.to_path_buf();

    if !combined_script.trim().is_empty() {
        fixup_vue_script_line_offsets(&mut scan, source);
    }

    scan.findings
        .extend(smells::collect_text_smells(path, source));

    if let Some(cap) = template_block_regex().captures(source) {
        let inner = cap.get(1).expect("template inner group");
        let tpl = inner.as_str();
        let tpl_start = inner.start();
        merge_template_usages(source, tpl, tpl_start, &mut scan.usages);
        scan.findings
            .extend(vue_template_a11y_findings(path, source, tpl, tpl_start));
    }

    scan
}

fn merge_template_usages(
    full_source: &str,
    template: &str,
    template_inner_start: usize,
    usages: &mut Vec<JsxUsage>,
) {
    let re = Regex::new(r#"<([A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*)"#)
        .expect("template component regex");
    for cap in re.captures_iter(template) {
        let component = cap.get(1).unwrap().as_str().to_string();
        let rel_start = cap.get(0).unwrap().start();
        let line_offset = template_inner_start + rel_start;
        let line = 1 + full_source[..line_offset.min(full_source.len())]
            .bytes()
            .filter(|&b| b == b'\n')
            .count() as u32;
        usages.push(JsxUsage {
            component,
            line,
            props: Vec::new(),
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn vue_template_and_script() {
        let src = r#"<template>
  <DesignHeader title="x" />
  <div/>
</template>
<script setup lang="ts">
import DesignHeader from './DesignHeader.vue'
const x = 1
</script>
"#;
        let scan = analyze_vue_file(&PathBuf::from("Page.vue"), src);
        assert!(
            scan.usages.iter().any(|u| u.component == "DesignHeader"),
            "{:?}",
            scan.usages
        );
    }

    #[test]
    fn vue_template_img_alt() {
        let src = r#"<template><img src="x" /></template><script setup>const x=1</script>"#;
        let scan = analyze_vue_file(&PathBuf::from("Bad.vue"), src);
        assert!(
            scan.findings.iter().any(|f| f.rule_id == "a11y-img-alt"),
            "{:?}",
            scan.findings
        );
    }
}
