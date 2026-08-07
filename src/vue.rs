//! Vue single-file component extraction (template usages + script definitions).

use std::collections::BTreeMap;
use std::path::Path;
use std::sync::OnceLock;

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Argument, CallExpression, Expression, ObjectExpression, ObjectPropertyKind, PropertyKey,
    TSType, TSTypeName,
};
use oxc_ast::visit::walk;
use oxc_ast::Visit;
use oxc_parser::{Parser, ParserReturn};
use oxc_span::SourceType;
use regex::Regex;

use crate::code_quality;
use crate::ecma::analyze_ecma_for_paths;
use crate::import_filter::ImportFilter;
use crate::lines::{line_of_offset, newline_offsets, offset_line};
use crate::model::{ComponentDefinition, DefinitionKind, FileScan, JsxUsage, LintFinding, Severity};
use crate::ts_shape_map;
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

fn select_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?si)<select(\s[^>]*)?>"#).unwrap())
}

fn textarea_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"(?si)<textarea(\s[^>]*)?>"#).unwrap())
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

/// `defineProps(['a', 'b'])` – array form (regex fallback / Options API shared helpers).
fn define_props_array_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"defineProps\s*\(\s*\[([^\]]*)\]"#).unwrap()
    })
}

/// Options API `props: ['a', 'b']`.
fn options_props_array_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"props\s*:\s*\[([^\]]*)\]"#).unwrap())
}

/// Options API `props: { … }` — opening only; body extracted with brace balancing.
fn options_props_object_open_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"props\s*:\s*\{"#).unwrap())
}

/// `defineProps({ … })` opening — body extracted with brace balancing (regex fallback).
fn define_props_object_open_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"defineProps\s*\(\s*\{"#).unwrap())
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

#[derive(Debug, Default)]
struct VueDeclaredProps {
    props: Vec<String>,
    options: BTreeMap<String, Vec<String>>,
    defaults: BTreeMap<String, String>,
}

/// Extract prop names (and optional TS options / withDefaults defaults) from a Vue `<script>` block.
fn extract_vue_declared_props(script_src: &str) -> VueDeclaredProps {
    if let Some(from_ast) = extract_vue_props_via_ast(script_src) {
        if !from_ast.props.is_empty() {
            return from_ast;
        }
    }
    extract_vue_props_via_regex(script_src)
}

fn extract_vue_props_via_ast(script_src: &str) -> Option<VueDeclaredProps> {
    let allocator = Allocator::default();
    let source_type = SourceType::tsx();
    let ParserReturn {
        program,
        panicked,
        errors,
        ..
    } = Parser::new(&allocator, script_src, source_type).parse();
    // Recovered parses can leave an incomplete AST; fall back to regex.
    if panicked || !errors.is_empty() {
        return None;
    }

    let shapes = ts_shape_map::collect_ts_prop_shape_map(&program);
    let named_options = ts_shape_map::collect_ts_prop_options_map(&program);
    let mut visitor = DefinePropsVisitor {
        shapes: &shapes,
        named_options: &named_options,
        props: Vec::new(),
        options: BTreeMap::new(),
        defaults: BTreeMap::new(),
    };
    visitor.visit_program(&program);

    let mut props = visitor.props;
    dedupe_preserve_order(&mut props);
    Some(VueDeclaredProps {
        props,
        options: visitor.options,
        defaults: visitor.defaults,
    })
}

struct DefinePropsVisitor<'a> {
    shapes: &'a std::collections::HashMap<String, Vec<String>>,
    named_options: &'a std::collections::HashMap<String, BTreeMap<String, Vec<String>>>,
    props: Vec<String>,
    options: BTreeMap<String, Vec<String>>,
    defaults: BTreeMap<String, String>,
}

impl<'a> Visit<'a> for DefinePropsVisitor<'_> {
    fn visit_call_expression(&mut self, expr: &CallExpression<'a>) {
        if let Some(name) = call_callee_name(&expr.callee) {
            if name == "defineProps" {
                self.ingest_define_props(expr);
            } else if name == "withDefaults" {
                self.ingest_with_defaults(expr);
            }
        }
        walk::walk_call_expression(self, expr);
    }
}

impl DefinePropsVisitor<'_> {
    fn ingest_define_props(&mut self, expr: &CallExpression<'_>) {
        if let Some(type_params) = expr.type_parameters.as_ref() {
            if let Some(first) = type_params.params.first() {
                let keys = ts_shape_map::props_from_type(first, self.shapes);
                self.props.extend(keys);
                for (k, v) in ts_shape_map::options_from_type(first, self.named_options) {
                    self.options.entry(k).or_insert(v);
                }
            }
        }

        if let Some(arg) = expr.arguments.first() {
            match arg {
                Argument::ArrayExpression(arr) => {
                    for el in &arr.elements {
                        if let Some(Expression::StringLiteral(s)) = el.as_expression() {
                            self.props.push(s.value.as_str().to_string());
                        }
                    }
                }
                Argument::ObjectExpression(obj) => {
                    self.props.extend(object_prop_keys(obj));
                    for (k, v) in object_string_defaults(obj) {
                        self.defaults.entry(k).or_insert(v);
                    }
                    for (k, v) in object_prop_type_options(obj) {
                        self.options.entry(k).or_insert(v);
                    }
                }
                _ => {}
            }
        }
    }

    fn ingest_with_defaults(&mut self, expr: &CallExpression<'_>) {
        // First arg is typically `defineProps(...)` — handled when that call is visited.
        if let Some(Argument::ObjectExpression(obj)) = expr.arguments.get(1) {
            for (k, v) in object_string_defaults(obj) {
                self.defaults.entry(k).or_insert(v);
            }
        }
    }
}

fn call_callee_name<'a>(expr: &'a Expression<'a>) -> Option<&'a str> {
    match expr {
        Expression::Identifier(id) => Some(id.name.as_str()),
        _ => None,
    }
}

fn object_prop_keys(obj: &ObjectExpression<'_>) -> Vec<String> {
    let mut keys = Vec::new();
    for prop in &obj.properties {
        let ObjectPropertyKind::ObjectProperty(p) = prop else {
            continue;
        };
        if p.computed {
            continue;
        }
        match &p.key {
            PropertyKey::StaticIdentifier(id) => keys.push(id.name.as_str().to_string()),
            PropertyKey::StringLiteral(s) => keys.push(s.value.as_str().to_string()),
            _ => {}
        }
    }
    keys
}

/// From runtime validators `{ foo: { default: 'x' } }` or withDefaults `{ foo: 'x' }`.
fn object_string_defaults(obj: &ObjectExpression<'_>) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for prop in &obj.properties {
        let ObjectPropertyKind::ObjectProperty(p) = prop else {
            continue;
        };
        if p.computed {
            continue;
        }
        let key = match &p.key {
            PropertyKey::StaticIdentifier(id) => id.name.as_str().to_string(),
            PropertyKey::StringLiteral(s) => s.value.as_str().to_string(),
            _ => continue,
        };
        match &p.value {
            Expression::StringLiteral(s) => {
                out.insert(key, s.value.as_str().to_string());
            }
            Expression::ObjectExpression(inner) => {
                if let Some(default_val) = nested_default_string(inner) {
                    out.insert(key, default_val);
                }
            }
            _ => {}
        }
    }
    out
}

fn nested_default_string(obj: &ObjectExpression<'_>) -> Option<String> {
    for prop in &obj.properties {
        let ObjectPropertyKind::ObjectProperty(p) = prop else {
            continue;
        };
        if p.computed {
            continue;
        }
        let is_default = match &p.key {
            PropertyKey::StaticIdentifier(id) => id.name.as_str() == "default",
            PropertyKey::StringLiteral(s) => s.value.as_str() == "default",
            _ => false,
        };
        if is_default {
            if let Expression::StringLiteral(s) = &p.value {
                return Some(s.value.as_str().to_string());
            }
        }
    }
    None
}

/// From runtime validators `{ foo: { type: String as PropType<'a' | 'b'> } }`
/// or shorthand `{ foo: String as PropType<'a' | 'b'> }`.
fn object_prop_type_options(obj: &ObjectExpression<'_>) -> BTreeMap<String, Vec<String>> {
    let mut out = BTreeMap::new();
    for prop in &obj.properties {
        let ObjectPropertyKind::ObjectProperty(p) = prop else {
            continue;
        };
        if p.computed {
            continue;
        }
        let key = match &p.key {
            PropertyKey::StaticIdentifier(id) => id.name.as_str().to_string(),
            PropertyKey::StringLiteral(s) => s.value.as_str().to_string(),
            _ => continue,
        };
        let options = match &p.value {
            Expression::ObjectExpression(inner) => nested_prop_type_options(inner),
            other => options_from_prop_type_expression(other),
        };
        if let Some(opts) = options {
            out.insert(key, opts);
        }
    }
    out
}

fn nested_prop_type_options(obj: &ObjectExpression<'_>) -> Option<Vec<String>> {
    for prop in &obj.properties {
        let ObjectPropertyKind::ObjectProperty(p) = prop else {
            continue;
        };
        if p.computed {
            continue;
        }
        let is_type = match &p.key {
            PropertyKey::StaticIdentifier(id) => id.name.as_str() == "type",
            PropertyKey::StringLiteral(s) => s.value.as_str() == "type",
            _ => false,
        };
        if is_type {
            return options_from_prop_type_expression(&p.value);
        }
    }
    None
}

fn options_from_prop_type_expression(expr: &Expression<'_>) -> Option<Vec<String>> {
    let ty = match expr {
        Expression::TSAsExpression(as_expr) => &as_expr.type_annotation,
        Expression::TSTypeAssertion(assertion) => &assertion.type_annotation,
        _ => return None,
    };
    options_from_prop_type_annotation(ty)
}

fn options_from_prop_type_annotation(ty: &TSType<'_>) -> Option<Vec<String>> {
    let ty = ty.without_parenthesized();
    match ty {
        TSType::TSTypeReference(r) => {
            let name = match &r.type_name {
                TSTypeName::IdentifierReference(id) => id.name.as_str(),
                _ => return None,
            };
            if name != "PropType" {
                return None;
            }
            let params = r.type_parameters.as_ref()?;
            let first = params.params.first()?;
            ts_shape_map::options_from_prop_type_arg(first)
        }
        _ => ts_shape_map::options_from_prop_type_arg(ty),
    }
}

fn dedupe_preserve_order(keys: &mut Vec<String>) {
    let mut seen = std::collections::HashSet::new();
    keys.retain(|k| seen.insert(k.clone()));
}

/// Brace-balanced slice starting after `{` at `open_brace` (index of `{`).
fn balanced_object_body(src: &str, open_brace: usize) -> Option<&str> {
    let bytes = src.as_bytes();
    if open_brace >= bytes.len() || bytes[open_brace] != b'{' {
        return None;
    }
    let mut depth = 0i32;
    let mut i = open_brace;
    while i < bytes.len() {
        if depth > 0 && skip_js_comment_or_string(bytes, &mut i) {
            continue;
        }
        match bytes[i] {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&src[open_brace + 1..i]);
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

/// Advance `i` past a JS line/block comment or quoted string starting at `bytes[i]`.
/// Returns `true` when a comment/string was skipped (caller should `continue`).
fn skip_js_comment_or_string(bytes: &[u8], i: &mut usize) -> bool {
    if *i >= bytes.len() {
        return false;
    }
    match bytes[*i] {
        b'/' if *i + 1 < bytes.len() => match bytes[*i + 1] {
            b'/' => {
                *i += 2;
                while *i < bytes.len() && bytes[*i] != b'\n' {
                    *i += 1;
                }
                true
            }
            b'*' => {
                *i += 2;
                while *i + 1 < bytes.len() && !(bytes[*i] == b'*' && bytes[*i + 1] == b'/') {
                    *i += 1;
                }
                *i = (*i + 2).min(bytes.len());
                true
            }
            _ => false,
        },
        b'\'' | b'"' => {
            let quote = bytes[*i];
            *i += 1;
            while *i < bytes.len() {
                if bytes[*i] == b'\\' {
                    *i = (*i + 2).min(bytes.len());
                    continue;
                }
                if bytes[*i] == quote {
                    *i += 1;
                    break;
                }
                *i += 1;
            }
            true
        }
        b'`' => {
            // Template literals may contain `${ … }` with nested braces/strings.
            *i += 1;
            while *i < bytes.len() {
                if bytes[*i] == b'\\' {
                    *i = (*i + 2).min(bytes.len());
                    continue;
                }
                if bytes[*i] == b'`' {
                    *i += 1;
                    break;
                }
                if bytes[*i] == b'$' && *i + 1 < bytes.len() && bytes[*i + 1] == b'{' {
                    *i += 2;
                    let mut depth = 1i32;
                    while *i < bytes.len() && depth > 0 {
                        if skip_js_comment_or_string(bytes, i) {
                            continue;
                        }
                        match bytes[*i] {
                            b'{' => depth += 1,
                            b'}' => depth -= 1,
                            _ => {}
                        }
                        *i += 1;
                    }
                    continue;
                }
                *i += 1;
            }
            true
        }
        _ => false,
    }
}

fn top_level_ident_keys(object_body: &str) -> Vec<String> {
    // Only keys at brace-depth 0 so nested `type:` / `default:` are ignored.
    let mut keys = Vec::new();
    let mut depth = 0i32;
    let mut line_start = 0usize;
    let bytes = object_body.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        if skip_js_comment_or_string(bytes, &mut i) {
            continue;
        }
        match bytes[i] {
            b'{' => depth += 1,
            b'}' => depth -= 1,
            b'\n' => {
                if depth == 0 {
                    let line = &object_body[line_start..i];
                    if let Some(cap) = ident_key_re().captures(line) {
                        keys.push(cap[1].to_string());
                    }
                }
                line_start = i + 1;
            }
            _ => {}
        }
        i += 1;
    }
    if depth == 0 && line_start < object_body.len() {
        let line = &object_body[line_start..];
        if let Some(cap) = ident_key_re().captures(line) {
            keys.push(cap[1].to_string());
        }
    }
    dedupe_preserve_order(&mut keys);
    keys
}

fn extract_vue_props_via_regex(script_src: &str) -> VueDeclaredProps {
    // Priority: defineProps array > defineProps object > options props array > options props object
    if let Some(cap) = define_props_array_re().captures(script_src) {
        return VueDeclaredProps {
            props: quoted_string_re()
                .captures_iter(&cap[1])
                .map(|c| c[1].to_string())
                .collect(),
            ..Default::default()
        };
    }
    if let Some(m) = define_props_object_open_re().find(script_src) {
        let open_brace = m.end() - 1;
        if let Some(body) = balanced_object_body(script_src, open_brace) {
            let props = top_level_ident_keys(body);
            if !props.is_empty() {
                return VueDeclaredProps {
                    props,
                    ..Default::default()
                };
            }
        }
    }
    if let Some(cap) = options_props_array_re().captures(script_src) {
        return VueDeclaredProps {
            props: quoted_string_re()
                .captures_iter(&cap[1])
                .map(|c| c[1].to_string())
                .collect(),
            ..Default::default()
        };
    }
    if let Some(m) = options_props_object_open_re().find(script_src) {
        let open_brace = m.end() - 1;
        if let Some(body) = balanced_object_body(script_src, open_brace) {
            return VueDeclaredProps {
                props: top_level_ident_keys(body),
                ..Default::default()
            };
        }
    }
    VueDeclaredProps::default()
}

/// Template-only accessibility checks (HTML in `<template>`).
/// True when attrs already include aria-label / aria-labelledby (static or bound).
fn vue_attrs_have_accessible_name(lower_attrs: &str) -> bool {
    lower_attrs.contains("aria-label=")
        || lower_attrs.contains("aria-labelledby=")
        || lower_attrs.contains(":aria-label")
        || lower_attrs.contains("v-bind:aria-label")
        || lower_attrs.contains(":aria-labelledby")
        || lower_attrs.contains("v-bind:aria-labelledby")
}

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
        // Bare `id` is not treated as an accessible name (label pairing not verified).
        if vue_attrs_have_accessible_name(&lower) {
            continue;
        }
        let pos = template_inner_start + cap.get(0).unwrap().start();
        out.push(LintFinding::new(
            "a11y-input-label",
            path.to_path_buf(),
            Some(offset_line(full_source, pos)),
            Severity::Warning,
            a11y::INPUT_LABEL,
        ));
    }

    for cap in select_re().captures_iter(template) {
        let attrs = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let lower = attrs.to_ascii_lowercase();
        if vue_attrs_have_accessible_name(&lower) {
            continue;
        }
        let pos = template_inner_start + cap.get(0).unwrap().start();
        out.push(LintFinding::new(
            "a11y-select-name",
            path.to_path_buf(),
            Some(offset_line(full_source, pos)),
            Severity::Warning,
            a11y::SELECT_NAME,
        ));
    }

    for cap in textarea_re().captures_iter(template) {
        let attrs = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let lower = attrs.to_ascii_lowercase();
        if vue_attrs_have_accessible_name(&lower) {
            continue;
        }
        let pos = template_inner_start + cap.get(0).unwrap().start();
        out.push(LintFinding::new(
            "a11y-textarea-name",
            path.to_path_buf(),
            Some(offset_line(full_source, pos)),
            Severity::Warning,
            a11y::TEXTAREA_NAME,
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

fn line_offset_before(newlines: &[usize], offset: usize) -> u32 {
    line_of_offset(newlines, offset).saturating_sub(1)
}

/// Merge Vue template component references into an ECMA analysis of the `<script>` blocks.
pub fn analyze_vue_file(path: &Path, source: &str, import_filter: &ImportFilter) -> FileScan {
    let caps: Vec<_> = script_block_re().captures_iter(source).collect();

    let pseudo_ts = path.with_extension("tsx");
    let pseudo_js = path.with_extension("jsx");

    let mut scan = FileScan::empty(path.to_path_buf());
    let newlines = newline_offsets(source);

    let all_script: String = caps
        .iter()
        .filter_map(|c| c.get(2))
        .map(|m| m.as_str())
        .collect::<Vec<_>>()
        .join("\n");

    if caps.is_empty() {
        scan.parse_errors
            .push("dslinter: Vue SFC has no <script> block".into());
    } else {
        for cap in &caps {
            let attrs = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            let inner_m = cap.get(2).expect("script inner group");
            let inner = inner_m.as_str();
            let line_offset = line_offset_before(&newlines, inner_m.start());

            let parse_as = if lang_is_ts(attrs)
                || source.contains("lang=\"ts\"")
                || source.contains("lang='ts'")
            {
                &pseudo_ts
            } else {
                &pseudo_js
            };

            let mut part = analyze_ecma_for_paths(path, parse_as, inner, false, import_filter);
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

    let vue_props = extract_vue_declared_props(&all_script);
    if !vue_props.props.is_empty() {
        let component_name =
            kebab::component_name_from_path(path).unwrap_or_else(|| "default".into());
        if let Some(def) = scan.definitions.iter_mut().find(|d| d.name == component_name) {
            if def.declared_props.is_empty() {
                def.declared_props = vue_props.props;
            }
            if def.declared_prop_options.is_empty() && !vue_props.options.is_empty() {
                def.declared_prop_options = vue_props.options;
            }
            if def.declared_prop_defaults.is_empty() && !vue_props.defaults.is_empty() {
                def.declared_prop_defaults = vue_props.defaults;
            }
        } else {
            scan.definitions.push(ComponentDefinition {
                name: component_name,
                kind: DefinitionKind::ExportDefaultAnonymous,
                line: 1,
                declared_props: vue_props.props,
                declared_prop_options: vue_props.options,
                declared_prop_defaults: vue_props.defaults,
                cva_binding_name: None,
            });
        }
    }

    scan.findings
        .extend(code_quality::collect_text_code_quality(path, source));

    if let Some(cap) = template_block_re().captures(source) {
        let inner = cap.get(1).expect("template inner group");
        let tpl = inner.as_str();
        let tpl_start = inner.start();
        let tpl_line_offset = line_offset_before(&newlines, tpl_start);
        let script_is_ts = caps.iter().any(|c| {
            let attrs = c.get(1).map(|m| m.as_str()).unwrap_or("");
            lang_is_ts(attrs) || source.contains("lang=\"ts\"") || source.contains("lang='ts'")
        });
        let external_bindings = import_filter.external_jsx_bindings_from_source(
            &all_script,
            if script_is_ts { &pseudo_ts } else { &pseudo_js },
        );
        merge_template_usages(
            &newlines,
            tpl,
            tpl_start,
            &mut scan.usages,
            &external_bindings,
        );
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
    newlines: &[usize],
    template: &str,
    template_inner_start: usize,
    usages: &mut Vec<JsxUsage>,
    external_bindings: &std::collections::HashSet<String>,
) {
    for cap in template_pascal_re().captures_iter(template) {
        let component = cap.get(1).unwrap().as_str().to_string();
        if crate::import_filter::usage_root_is_external(&component, external_bindings) {
            continue;
        }
        let rel_start = cap.get(0).unwrap().start();
        let line = line_of_offset(&newlines, template_inner_start + rel_start);
        usages.push(JsxUsage {
            component,
            line,
            props: Vec::new(),
            prop_values: std::collections::BTreeMap::new(),
            example_tree: None,
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
            example_tree: None,
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
        let scan = analyze_vue_file(&PathBuf::from("Page.vue"), src, &ImportFilter::default());
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
        let scan = analyze_vue_file(&PathBuf::from("Page.vue"), src, &ImportFilter::default());
        assert!(
            scan.usages.iter().any(|u| u.component == "DesignHeader"),
            "{:?}",
            scan.usages
        );
    }

    #[test]
    fn vue_template_img_alt() {
        let src = r#"<template><img src="x" /></template><script setup>const x=1</script>"#;
        let scan = analyze_vue_file(&PathBuf::from("Bad.vue"), src, &ImportFilter::default());
        assert!(
            scan.findings.iter().any(|f| f.rule_id == "a11y-img-alt"),
            "{:?}",
            scan.findings
        );
    }

    #[test]
    fn vue_template_anchor_requires_href() {
        let src = r#"<template><a>link</a></template><script setup>const x=1</script>"#;
        let scan = analyze_vue_file(&PathBuf::from("Link.vue"), src, &ImportFilter::default());
        assert!(
            scan.findings
                .iter()
                .any(|f| f.rule_id == "a11y-anchor-href"),
            "{:?}",
            scan.findings
        );
    }

    #[test]
    fn vue_template_input_label() {
        let src = r#"<template><input type="text" /></template><script setup>const x=1</script>"#;
        let scan = analyze_vue_file(&PathBuf::from("Field.vue"), src, &ImportFilter::default());
        assert!(
            scan.findings
                .iter()
                .any(|f| f.rule_id == "a11y-input-label"),
            "{:?}",
            scan.findings
        );
    }

    #[test]
    fn vue_a11y_select_and_textarea_warn_without_name() {
        let src = r#"<template>
  <select data-testid="country"></select>
  <textarea id="notes"></textarea>
</template>
<script setup lang="ts">
defineProps({ label: String })
</script>"#;
        let scan = analyze_vue_file(&PathBuf::from("Form.vue"), src, &ImportFilter::default());
        assert!(
            scan.findings
                .iter()
                .any(|f| f.rule_id == "a11y-select-name" && f.severity == Severity::Warning),
            "{:?}",
            scan.findings
        );
        assert!(
            scan.findings
                .iter()
                .any(|f| f.rule_id == "a11y-textarea-name" && f.severity == Severity::Warning),
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
        let scan = analyze_vue_file(&PathBuf::from("MyCard.vue"), src, &ImportFilter::default());
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
        let scan = analyze_vue_file(&PathBuf::from("MyButton.vue"), src, &ImportFilter::default());
        let def = scan
            .definitions
            .iter()
            .find(|d| d.name == "MyButton")
            .expect("MyButton definition");
        assert!(def.declared_props.contains(&"label".to_string()));
        assert!(def.declared_props.contains(&"disabled".to_string()));
    }

    #[test]
    fn vue_define_props_nested_runtime_validators() {
        let src = r#"<template><div /></template>
<script setup lang="ts">
import type { PropType } from 'vue'
const props = defineProps({
  type: {
    type: String as PropType<'button' | 'reset' | 'submit'>,
    default: 'button',
  },
  color: {
    type: String as PropType<'primary' | 'secondary'>,
    default: 'primary',
  },
  size: {
    type: String as PropType<'sm' | 'md' | 'lg'>,
    default: 'md',
  },
})
</script>"#;
        let scan = analyze_vue_file(&PathBuf::from("UiButton.vue"), src, &ImportFilter::default());
        let def = scan
            .definitions
            .iter()
            .find(|d| d.name == "UiButton")
            .expect("UiButton definition");
        assert_eq!(
            def.declared_props,
            vec!["type", "color", "size"],
            "{:?}",
            def.declared_props
        );
        assert_eq!(def.declared_prop_defaults.get("type").map(String::as_str), Some("button"));
        assert_eq!(def.declared_prop_defaults.get("color").map(String::as_str), Some("primary"));
        assert_eq!(def.declared_prop_defaults.get("size").map(String::as_str), Some("md"));
        assert_eq!(
            def.declared_prop_options.get("type").map(|v| v.as_slice()),
            Some(&["button".to_string(), "reset".to_string(), "submit".to_string()][..])
        );
        assert_eq!(
            def.declared_prop_options.get("color").map(|v| v.as_slice()),
            Some(&["primary".to_string(), "secondary".to_string()][..])
        );
        assert_eq!(
            def.declared_prop_options.get("size").map(|v| v.as_slice()),
            Some(&["sm".to_string(), "md".to_string(), "lg".to_string()][..])
        );
    }

    #[test]
    fn vue_define_props_ts_interface_with_defaults() {
        let src = r#"<template><div /></template>
<script setup lang="ts">
interface Props {
  type?: 'button' | 'reset' | 'submit'
  color?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  color: 'primary',
  size: 'md',
})
</script>"#;
        let scan = analyze_vue_file(&PathBuf::from("UiButton.vue"), src, &ImportFilter::default());
        let def = scan
            .definitions
            .iter()
            .find(|d| d.name == "UiButton")
            .expect("UiButton definition");
        assert_eq!(
            def.declared_props,
            vec!["type", "color", "size"],
            "{:?}",
            def.declared_props
        );
        assert_eq!(
            def.declared_prop_options.get("type").map(|v| v.as_slice()),
            Some(&["button".to_string(), "reset".to_string(), "submit".to_string()][..])
        );
        assert_eq!(
            def.declared_prop_options.get("size").map(|v| v.as_slice()),
            Some(&["sm".to_string(), "md".to_string(), "lg".to_string()][..])
        );
        assert_eq!(def.declared_prop_defaults.get("type").map(String::as_str), Some("button"));
        assert_eq!(def.declared_prop_defaults.get("size").map(String::as_str), Some("md"));
    }

    #[test]
    fn vue_define_props_inline_type_literal() {
        let src = r#"<template><div /></template>
<script setup lang="ts">
defineProps<{
  title: string
  variant?: 'solid' | 'outline'
}>()
</script>"#;
        let scan = analyze_vue_file(&PathBuf::from("Chip.vue"), src, &ImportFilter::default());
        let def = scan
            .definitions
            .iter()
            .find(|d| d.name == "Chip")
            .expect("Chip definition");
        assert!(def.declared_props.contains(&"title".to_string()), "{:?}", def.declared_props);
        assert!(def.declared_props.contains(&"variant".to_string()), "{:?}", def.declared_props);
        assert_eq!(
            def.declared_prop_options.get("variant").map(|v| v.as_slice()),
            Some(&["solid".to_string(), "outline".to_string()][..])
        );
    }

    #[test]
    fn balanced_object_body_ignores_braces_in_strings_and_comments() {
        let src = r#"{
  meta: { default: '{}' }, // trailing { }
  note: { default: "a } b" },
  /* ignore } here */
  label: String,
}"#;
        let body = balanced_object_body(src, 0).expect("balanced body");
        let keys = top_level_ident_keys(body);
        assert_eq!(keys, vec!["meta", "note", "label"], "{body:?} -> {keys:?}");
    }

    #[test]
    fn balanced_object_body_ignores_braces_in_template_interpolations() {
        let src = r#"{
  payload: { default: `${'{'}nested${'}'}` },
  title: String,
}"#;
        let body = balanced_object_body(src, 0).expect("balanced body");
        let keys = top_level_ident_keys(body);
        assert_eq!(keys, vec!["payload", "title"], "{body:?} -> {keys:?}");
    }

    #[test]
    fn extract_vue_props_via_regex_survives_braces_in_defaults() {
        // Force regex path: invalid/unparseable enough that AST returns None isn't guaranteed,
        // so call the regex helper directly.
        let script = r#"
defineProps({
  payload: { type: String, default: '{}' },
  title: String,
})
"#;
        let extracted = extract_vue_props_via_regex(script);
        assert_eq!(
            extracted.props,
            vec!["payload", "title"],
            "{:?}",
            extracted.props
        );
    }
}
