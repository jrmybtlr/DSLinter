//! AST-or-regex fallback iteration for token and class-string rules.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use regex::Regex;

use crate::lines::{line_of_offset, newline_offsets};
use crate::model::FileScan;
use crate::util::regex::{class_attr_re, class_helper_attr_re, quoted_literal_re};

pub fn for_each_ast_text(
    files: &[FileScan],
    mut f: impl FnMut(&Path, u32, &str),
) {
    for file in files {
        if file.ast_extracts.is_empty() {
            continue;
        }
        for lit in &file.ast_extracts.string_literals {
            f(&file.path, lit.line, &lit.value);
        }
        for cls in &file.ast_extracts.class_strings {
            f(&file.path, cls.line, &cls.text);
        }
    }
}

pub fn for_each_style_color_value(
    files: &[FileScan],
    mut f: impl FnMut(&Path, u32, &str),
) {
    for file in files {
        for style in &file.ast_extracts.style_values {
            f(&file.path, style.line, &style.value);
        }
    }
}

pub fn for_each_source_regex(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
    re: fn() -> &'static Regex,
    mut f: impl FnMut(&Path, u32, &str),
) {
    for file in files {
        if !file.ast_extracts.is_empty() {
            continue;
        }
        let Some(text) = sources.get(&file.path) else {
            continue;
        };
        let newlines = newline_offsets(text);
        for m in re().find_iter(text) {
            f(
                &file.path,
                line_of_offset(&newlines, m.start()),
                m.as_str(),
            );
        }
    }
}

pub fn for_each_class_string(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
    mut f: impl FnMut(&Path, u32, &str),
) {
    for file in files {
        if !file.ast_extracts.class_strings.is_empty() {
            for cls in &file.ast_extracts.class_strings {
                f(&file.path, cls.line, &cls.text);
            }
            continue;
        }
        let Some(text) = sources.get(&file.path) else {
            continue;
        };
        let static_class_re = class_attr_re();
        let helper_re = class_helper_attr_re();
        let literal_re = quoted_literal_re();
        let newlines = newline_offsets(text);
        for caps in static_class_re.captures_iter(text) {
            let Some(full) = caps.get(0) else {
                continue;
            };
            let classes = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            f(
                &file.path,
                line_of_offset(&newlines, full.start()),
                classes,
            );
        }
        for caps in helper_re.captures_iter(text) {
            let Some(full) = caps.get(0) else {
                continue;
            };
            let args = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let mut all_classes = String::new();
            for lit in literal_re.captures_iter(args) {
                if let Some(inner) = lit.get(1).map(|m| m.as_str()) {
                    if !all_classes.is_empty() {
                        all_classes.push(' ');
                    }
                    all_classes.push_str(inner);
                }
            }
            if !all_classes.is_empty() {
                f(
                    &file.path,
                    line_of_offset(&newlines, full.start()),
                    &all_classes,
                );
            }
        }
    }
}
