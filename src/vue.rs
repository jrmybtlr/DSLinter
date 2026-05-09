//! Vue single-file component extraction (template usages + script definitions).

use std::path::Path;

use regex::Regex;

use crate::ecma::analyze_ecma_file;
use crate::model::{FileScan, JsxUsage};

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
        }
    } else {
        analyze_ecma_file(&pseudo_path, &combined_script)
    };
    scan.path = path.to_path_buf();

    if let Some(cap) = template_block_regex().captures(source) {
        let inner = cap.get(1).expect("template inner group");
        let tpl = inner.as_str();
        let tpl_start = inner.start();
        merge_template_usages(source, tpl, tpl_start, &mut scan.usages);
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
}
