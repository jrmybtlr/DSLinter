//! Vue single-file component extraction (template usages + script definitions).

use std::path::Path;
use std::sync::OnceLock;

use regex::Regex;

use crate::code_quality;
use crate::ecma::analyze_ecma_for_paths;
use crate::lines::{line_of_offset, newline_offsets, offset_line};
use crate::model::{ComponentDefinition, DefinitionKind, FileScan, JsxUsage, LintFinding, Severity};
use crate::util::{a11y, kebab};

// ── Static regex helpers (compiled once) ────────────────────────────────────

fn script_block_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?si)<script([^>]*)>(.*?)</script>"#).unwrap())
}

fn template_block_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?si)<template(?:\s[^>]*)?>(.*?)</template>"#).unwrap()
    })
}

fn img_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?si)<img\s([^>]*?)\s*/?>"#).unwrap())
}

fn anchor_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?si)<a(\s[^>]*)?>"#).unwrap())
}

fn input_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?si)<input\s([^>]*?)\s*/?>"#).unwrap())
}

fn template_pascal_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"<([A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*)"#).unwrap()
    })
}

fn template_kebab_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)"#).unwrap())
}

/// `defineProps(['a', 'b'])` – array form.
fn define_props_array_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"defineProps\s*\(\s*\[([^\]]*)\]"#).unwrap()
    })
}

/// `defineProps({ a: ..., b: ... })` – object form (key names only).
fn define_props_object_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"defineProps\s*\(\s*\{([^}]*)\}"#).unwrap())
}

/// Options API `props: ['a', 'b']`.
fn options_props_array_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"props\s*:\s*\[([^\]]*)\]"#).unwrap())
}

/// Options API `props: { a: ..., b: ... }`.
fn options_props_object_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"props\s*:\s*\{([^}]*)\}"#).unwrap())
}

/// Quoted string literal (single or double quotes).
fn quoted_string_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"['"]([A-Za-z_$][A-Za-z0-9_$]*)['"]"#).unwrap())
}

/// Bare identifier key (start of an object property).
fn ident_key_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?m)^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*:"#).unwrap())
}

fn lang_is_ts(attrs: &str) -> bool {
    attrs.contains("lang=\"ts\"")
        || attrs.contains("lang='ts'")
        || attrs.contains("lang=\"tsx\"")
        || attrs.contains("lang='tsx'")
}

// ── Prop extraction from Vue script source ───────────────────────────────────

/// Extract prop names from a Vue `<script>` block by matching `defineProps` or
/// the options API `props` field.  Returns an empty `Vec` when nothing is found.
fn extract_vue_declared_props(script_src: &str) -> Vec<String> {
    // Priority: defineProps array > defineProps object > options props array > options props object
    if let Some(cap) = define_props_array_re().captures(script_src) {
        return quoted_string_re()
            .captures_iter(&cap[1])
            .map(|c| c[1].to_string())
            .collect();
    }
    if let Some(cap) = define_props_object_re().captures(script_src) {
        return ident_key_re()
            .captures_iter(&cap[1])
            .map(|c| c[1].to_string())
            .collect();
    }
    if let Some(cap) = options_props_array_re().captures(script_src) {
        return quoted_string_re()
            .captures_iter(&cap[1])
            .map(|c| c[1].to_string())
            .collect();
    }
    if let Some(cap) = options_props_object_re().captures(script_src) {
        return ident_key_re()
            .captures_iter(&cap[1])
            .map(|c| c[1].to_string())
            .collect();
    }
    Vec::new()
}

/// Template-only accessibility checks (HTML in `<template>`).
fn vue_template_a11y_findings(
    path: &Path,
    full_source: &str,
    template: &str,
    template_inner_start: usize,
) -> Vec<LintFinding> {
    let mut out = Vec::new();

    for cap in img_re().captures_iter(template) {
        let attrs = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        if attrs.to_ascii_lowercase().contains("alt=") {
            continue;
        }
        let pos = template_inner_start + cap.get(0).unwrap().start();
        out.push(LintFinding::new(
            "a11y-img-alt",
            path.to_path_buf(),
            Some(offset_line(full_source, pos)),
            Severity::Warning,
            a11y::IMG_ALT,
        ));
    }

    for cap in anchor_re().captures_iter(template) {
        let attrs = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let lower = attrs.to_ascii_lowercase();
        let pos = template_inner_start + cap.get(0).unwrap().start();
        let line = offset_line(full_source, pos);

        if !lower.contains("href=") {
            out.push(LintFinding::new(
                "a11y-anchor-href",
                path.to_path_buf(),
                Some(line),
                Severity::Warning,
                a11y::ANCHOR_HREF,
            ));
            continue;
        }

        let bad_href = lower.contains("href=\"#\"")
            || lower.contains("href='#'")
            || lower.contains("href=\"\"")
            || lower.contains("href=''")
            || lower.contains("javascript:");
        if bad_href {
            out.push(LintFinding::new(
                "a11y-anchor-placeholder-href",
                path.to_path_buf(),
                Some(line),
                Severity::Warning,
                a11y::ANCHOR_PLACEHOLDER_HREF,
            ));
        }
    }

    for cap in input_re().captures_iter(template) {
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
        out.push(LintFinding::new(
            "a11y-input-label",
            path.to_path_buf(),
            Some(offset_line(full_source, pos)),
            Severity::Info,
            a11y::INPUT_LABEL,
        ));
    }

    out
}

fn merge_file_scan(into: &mut FileScan, mut part: FileScan) {
    into.definitions.append(&mut part.definitions);
    into.usages.append(&mut part.usages);
    into.findings.append(&mut part.findings);
    into.parse_errors.append(&mut part.parse_errors);
    into.ast_extracts.merge_from(part.ast_extracts);
}

fn line_offset_before(source: &str, offset: usize) -> u32 {
    line_of_offset(&newline_offsets(source), offset).saturating_sub(1)
}

/// Merge Vue template component references into an ECMA analysis of the `<script>` blocks.
pub fn analyze_vue_file(path: &Path, source: &str) -> FileScan {
    let caps: Vec<_> = script_block_re().captures_iter(source).collect();

    let pseudo_ts = path.with_extension("tsx");
    let pseudo_js = path.with_extension("jsx");

    let mut scan = FileScan::empty(path.to_path_buf());

    let all_script: String = caps
        .iter()
        .filter_map(|c| c.get(2))
        .map(|m| m.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    if caps.is_empty() {
        scan.parse_errors
            .push("dslint: Vue SFC has no <script> block".into());
    } else {
        for cap in &caps {
            let attrs = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            let inner_m = cap.get(2).expect("script inner group");
            let inner = inner_m.as_str();
            let line_offset = line_offset_before(source, inner_m.start());

            let parse_as = if lang_is_ts(attrs)
                || source.contains("lang=\"ts\"")
                || source.contains("lang='ts'")
            {
                &pseudo_ts
            } else {
                &pseudo_js
            };

            let mut part = analyze_ecma_for_paths(path, parse_as, inner, false);
            for d in &mut part.definitions {
                d.line += line_offset;
            }
            for u in &mut part.usages {
                u.line += line_offset;
            }
            for f in &mut part.findings {
                if let Some(ln) = f.line.as_mut() {
                    *ln += line_offset;
                }
            }
            crate::class_strings::offset_ast_extracts(&mut part.ast_extracts, line_offset);
            merge_file_scan(&mut scan, part);
        }
    }

    let vue_declared_props = extract_vue_declared_props(&all_script);
    if !vue_declared_props.is_empty() {
        let component_name =
            kebab::component_name_from_path(path).unwrap_or_else(|| "default".into());
        if let Some(def) = scan.definitions.iter_mut().find(|d| d.name == component_name) {
            if def.declared_props.is_empty() {
                def.declared_props = vue_declared_props;
            }
        } else {
            scan.definitions.push(ComponentDefinition {
                name: component_name,
                kind: DefinitionKind::ExportDefaultAnonymous,
                line: 1,
                declared_props: vue_declared_props,
            });
        }
    }

    scan.findings
        .extend(code_quality::collect_text_code_quality(path, source));

    if let Some(cap) = template_block_re().captures(source) {
        let inner = cap.get(1).expect("template inner group");
        let tpl = inner.as_str();
        let tpl_start = inner.start();
        let tpl_line_offset = line_offset_before(source, tpl_start);
        merge_template_usages(source, tpl, tpl_start, &mut scan.usages);
        scan.findings
            .extend(vue_template_a11y_findings(path, source, tpl, tpl_start));
        crate::class_strings::extend_template_class_extracts(
            &mut scan.ast_extracts,
            tpl,
            tpl_line_offset,
        );
    }

    scan
}

fn merge_template_usages(
    full_source: &str,
    template: &str,
    template_inner_start: usize,
    usages: &mut Vec<JsxUsage>,
) {
    let newlines = newline_offsets(full_source);

    for cap in template_pascal_re().captures_iter(template) {
        let component = cap.get(1).unwrap().as_str().to_string();
        let rel_start = cap.get(0).unwrap().start();
        let line = line_of_offset(&newlines, template_inner_start + rel_start);
        usages.push(JsxUsage {
            component,
            line,
            props: Vec::new(),
            prop_values: std::collections::BTreeMap::new(),
        });
    }

    for cap in template_kebab_re().captures_iter(template) {
        let raw = cap.get(1).unwrap().as_str();
        let component = kebab::kebab_to_pascal(raw);
        let rel_start = cap.get(0).unwrap().start();
        let line = line_of_offset(&newlines, template_inner_start + rel_start);
        usages.push(JsxUsage {
            component,
            line,
            props: Vec::new(),
            prop_values: std::collections::BTreeMap::new(),
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
    fn vue_template_kebab_case() {
        let src = r#"<template>
  <design-header title="x" />
</template>
<script setup lang="ts">
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

    #[test]
    fn vue_define_props_array_syntax() {
        let src = r#"<template><div /></template>
<script setup lang="ts">
defineProps(['title', 'color'])
</script>"#;
        let scan = analyze_vue_file(&PathBuf::from("MyCard.vue"), src);
        let def = scan
            .definitions
            .iter()
            .find(|d| d.name == "MyCard")
            .expect("MyCard definition from file name");
        assert!(
            def.declared_props.contains(&"title".to_string()),
            "{:?}",
            def.declared_props
        );
        assert!(def.declared_props.contains(&"color".to_string()));
    }

    #[test]
    fn vue_define_props_object_syntax() {
        let src = r#"<template><div /></template>
<script setup lang="ts">
defineProps({
  label: String,
  disabled: Boolean,
})
</script>"#;
        let scan = analyze_vue_file(&PathBuf::from("MyButton.vue"), src);
        let def = scan
            .definitions
            .iter()
            .find(|d| d.name == "MyButton")
            .expect("MyButton definition");
        assert!(def.declared_props.contains(&"label".to_string()));
        assert!(def.declared_props.contains(&"disabled".to_string()));
    }
}
