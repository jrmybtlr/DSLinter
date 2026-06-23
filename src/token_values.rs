//! Design-token color allowlists and Tailwind size-scale matching.

use std::collections::{HashMap, HashSet};

use crate::lazy_regex;
use crate::model::{CssTokenCategory, CssTokenSummary};

lazy_regex!(css_var_ref_re, r"var\(\s*(--[a-zA-Z0-9][a-zA-Z0-9_-]*)");
lazy_regex!(rgb_re, r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)");
lazy_regex!(hex_in_text_re, r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b");
lazy_regex!(
    tw_arbitrary_util_re,
    r#"(?:(?:^|[\s"'])|(?:[\w-]+:))((?:min-w|max-w|min-h|max-h|space-x|space-y|w|h|size|gap|p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr|inset|bg|text|border|from|to|via|fill|stroke|ring))-\[([^\]]+)\]"#
);

const REM_BASE_PX: f32 = 16.0;
const VAR_RESOLVE_MAX_DEPTH: usize = 8;

/// Normalized hex colors allowed by scanned design tokens (`#rrggbb` lowercase).
#[derive(Debug, Clone, Default)]
pub struct ColorAllowlist {
    allowed: HashSet<String>,
    /// hex -> token name for fix suggestions
    token_by_hex: HashMap<String, String>,
}

impl ColorAllowlist {
    pub fn from_css_tokens(summary: &CssTokenSummary) -> Self {
        let mut var_map: HashMap<String, String> = HashMap::new();
        for def in &summary.definitions {
            var_map.insert(def.name.clone(), def.value.clone());
        }

        let mut allowed = HashSet::new();
        let mut token_by_hex = HashMap::new();

        for def in &summary.definitions {
            if def.category != CssTokenCategory::Color {
                continue;
            }
            if let Some(hex) = resolve_to_hex(&def.value, &var_map) {
                allowed.insert(hex.clone());
                token_by_hex.entry(hex).or_insert_with(|| def.name.clone());
            }
        }

        Self {
            allowed,
            token_by_hex,
        }
    }

    pub fn is_allowed(&self, color: &str) -> bool {
        parse_css_color(color)
            .map(|hex| self.allowed.contains(&hex))
            .unwrap_or(false)
    }

    pub fn token_for_color(&self, color: &str) -> Option<&str> {
        parse_css_color(color).and_then(|hex| self.token_by_hex.get(&hex).map(String::as_str))
    }

    pub fn is_empty(&self) -> bool {
        self.allowed.is_empty()
    }
}

/// Tailwind default spacing scale + custom `@theme --spacing-*` entries.
#[derive(Debug, Clone)]
pub struct SizeScale {
    /// px value (rounded to 0.01) -> utility suffix (`20`, `layout-lg`, …)
    by_px: HashMap<i32, String>,
    /// theme suffixes for preference when multiple entries share px
    theme_suffixes: HashSet<String>,
}

impl Default for SizeScale {
    fn default() -> Self {
        Self::default_tailwind()
    }
}

impl SizeScale {
    pub fn default_tailwind() -> Self {
        let keys = [
            "0", "px", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "5", "6", "7", "8", "9",
            "10", "11", "12", "14", "16", "20", "24", "28", "32", "36", "40", "44", "48", "52",
            "56", "60", "64", "72", "80", "96",
        ];
        let mut by_px = HashMap::new();
        for key in keys {
            if let Some(px) = tailwind_key_to_px(key) {
                by_px.insert(px_key(px), key.to_string());
            }
        }
        Self {
            by_px,
            theme_suffixes: HashSet::new(),
        }
    }

    pub fn extend_from_css_tokens(mut self, summary: Option<&CssTokenSummary>) -> Self {
        let Some(summary) = summary else {
            return self;
        };
        for def in &summary.definitions {
            if def.category != CssTokenCategory::Spacing {
                continue;
            }
            let Some(suffix) = def.name.strip_prefix("--spacing-") else {
                continue;
            };
            if let Some(px) = parse_css_length(&def.value) {
                self.theme_suffixes.insert(suffix.to_string());
                self.by_px.insert(px_key(px), suffix.to_string());
            }
        }
        self
    }

    /// If `prefix` + `[arbitrary]` duplicates a known scale value, return suggested utility.
    pub fn match_size_utility(&self, prefix: &str, arbitrary: &str) -> Option<String> {
        if !is_size_utility_prefix(prefix) {
            return None;
        }
        let trimmed = arbitrary.trim();
        if is_non_size_arbitrary(trimmed) {
            return None;
        }
        let px = parse_css_length(trimmed)?;
        let suffix = self.by_px.get(&px_key(px))?;
        Some(format!("{prefix}-{suffix}"))
    }
}

pub fn normalize_hex(raw: &str) -> Option<String> {
    let s = raw.trim().trim_start_matches('#');
    match s.len() {
        3 => {
            let chars: Vec<char> = s.chars().collect();
            if chars.iter().all(|c| c.is_ascii_hexdigit()) {
                Some(format!(
                    "#{}{}{}{}{}{}",
                    chars[0],
                    chars[0],
                    chars[1],
                    chars[1],
                    chars[2],
                    chars[2]
                )
                .to_ascii_lowercase())
            } else {
                None
            }
        }
        6 if s.chars().all(|c| c.is_ascii_hexdigit()) => Some(format!("#{s}").to_ascii_lowercase()),
        _ => None,
    }
}

pub fn parse_css_color(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.starts_with('#') {
        return normalize_hex(trimmed);
    }
    if let Some(hex) = rgb_re().captures(trimmed).and_then(|c| {
        let r: u8 = c.get(1)?.as_str().parse().ok()?;
        let g: u8 = c.get(2)?.as_str().parse().ok()?;
        let b: u8 = c.get(3)?.as_str().parse().ok()?;
        Some(format!("#{:02x}{:02x}{:02x}", r, g, b))
    }) {
        return Some(hex);
    }
    None
}

pub fn parse_css_length(raw: &str) -> Option<f32> {
    let trimmed = raw.trim();
    if trimmed.ends_with("px") {
        let num = trimmed.trim_end_matches("px").trim();
        return num.parse::<f32>().ok();
    }
    if trimmed.ends_with("rem") {
        let num = trimmed.trim_end_matches("rem").trim();
        return num.parse::<f32>().ok().map(|rem| rem * REM_BASE_PX);
    }
    None
}

pub fn is_size_utility_prefix(prefix: &str) -> bool {
    matches!(
        prefix,
        "w" | "h"
            | "min-w"
            | "max-w"
            | "min-h"
            | "max-h"
            | "size"
            | "gap"
            | "p"
            | "m"
            | "px"
            | "py"
            | "mx"
            | "my"
            | "pt"
            | "pb"
            | "pl"
            | "pr"
            | "mt"
            | "mb"
            | "ml"
            | "mr"
            | "space-x"
            | "space-y"
            | "inset"
    )
}

pub fn is_color_utility_prefix(prefix: &str) -> bool {
    matches!(
        prefix,
        "bg" | "text" | "border" | "from" | "to" | "via" | "fill" | "stroke" | "ring"
    )
}

fn is_non_size_arbitrary(value: &str) -> bool {
    value.starts_with("var(")
        || value.starts_with("calc(")
        || value.contains('%')
        || value.contains('_')
        || value.contains(' ')
        || value.starts_with('#')
        || value.contains("rgba")
        || value.contains("rgb(")
}

fn px_key(px: f32) -> i32 {
    (px * 100.0).round() as i32
}

fn tailwind_key_to_px(key: &str) -> Option<f32> {
    match key {
        "0" => Some(0.0),
        "px" => Some(1.0),
        _ => key
            .parse::<f32>()
            .ok()
            .map(|units| units * 0.25 * REM_BASE_PX),
    }
}

fn resolve_to_hex(value: &str, var_map: &HashMap<String, String>) -> Option<String> {
    resolve_value(value, var_map, 0).and_then(|resolved| parse_css_color(&resolved))
}

fn resolve_value(value: &str, var_map: &HashMap<String, String>, depth: usize) -> Option<String> {
    if depth > VAR_RESOLVE_MAX_DEPTH {
        return None;
    }
    let trimmed = value.trim();
    if let Some(name) = css_var_ref_re()
        .captures(trimmed)
        .and_then(|c| c.get(1).map(|m| m.as_str()))
    {
        let next = var_map.get(name)?;
        return resolve_value(next, var_map, depth + 1);
    }
    Some(trimmed.to_string())
}

/// Scan class/text for hardcoded colors not in the allowlist.
pub fn find_hardcoded_colors_in_text(
    text: &str,
    allowlist: Option<&ColorAllowlist>,
) -> Vec<String> {
    let mut out = Vec::new();
    for m in hex_in_text_re().find_iter(text) {
        let raw = m.as_str();
        if allowlist.is_some_and(|a| a.is_allowed(raw)) {
            continue;
        }
        if let Some(hex) = parse_css_color(raw) {
            if !out.contains(&hex) {
                out.push(hex);
            }
        }
    }
    for m in rgb_re().find_iter(text) {
        let raw = m.as_str();
        if allowlist.is_some_and(|a| a.is_allowed(raw)) {
            continue;
        }
        if let Some(hex) = parse_css_color(raw) {
            if !out.contains(&hex) {
                out.push(hex);
            }
        }
    }
    out
}

/// Scan class string for Tailwind arbitrary utilities.
pub fn find_arbitrary_utilities_in_text(text: &str) -> Vec<(String, String)> {
    tw_arbitrary_util_re()
        .captures_iter(text)
        .filter_map(|c| {
            let prefix = c.get(1)?.as_str().to_string();
            let arbitrary = c.get(2)?.as_str().to_string();
            Some((prefix, arbitrary))
        })
        .collect()
}

pub fn is_style_color_property(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "color"
            | "backgroundcolor"
            | "background"
            | "background-color"
            | "bordercolor"
            | "border"
            | "border-color"
            | "outlinecolor"
            | "outline-color"
            | "fill"
            | "stroke"
            | "border-top-color"
            | "border-right-color"
            | "border-bottom-color"
            | "border-left-color"
    )
}

/// Parse `color: #fff; background: red` style strings.
pub fn parse_style_string(raw: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    for decl in raw.split(';') {
        let decl = decl.trim();
        if decl.is_empty() {
            continue;
        }
        let Some((prop, val)) = decl.split_once(':') else {
            continue;
        };
        let prop = prop.trim().to_string();
        let val = val.trim().to_string();
        if is_style_color_property(&prop) {
            out.push((prop, val));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{CssTokenDefinition, CssTokenScope, CssTokenSummary};
    use std::path::PathBuf;

    fn color_def(name: &str, value: &str) -> CssTokenDefinition {
        CssTokenDefinition {
            name: name.to_string(),
            value: value.to_string(),
            category: CssTokenCategory::Color,
            scope: CssTokenScope::Theme,
            path: PathBuf::from("theme.css"),
            line: 1,
        }
    }

    fn spacing_def(name: &str, value: &str) -> CssTokenDefinition {
        CssTokenDefinition {
            name: name.to_string(),
            value: value.to_string(),
            category: CssTokenCategory::Spacing,
            scope: CssTokenScope::Theme,
            path: PathBuf::from("theme.css"),
            line: 1,
        }
    }

    #[test]
    fn normalize_hex_expands_shorthand() {
        assert_eq!(normalize_hex("#abc").as_deref(), Some("#aabbcc"));
        assert_eq!(normalize_hex("#DC2626").as_deref(), Some("#dc2626"));
    }

    #[test]
    fn parse_css_color_rgb() {
        assert_eq!(
            parse_css_color("rgb(220, 38, 38)").as_deref(),
            Some("#dc2626")
        );
    }

    #[test]
    fn parse_css_length_units() {
        assert_eq!(parse_css_length("80px"), Some(80.0));
        assert_eq!(parse_css_length("2rem"), Some(32.0));
    }

    #[test]
    fn color_allowlist_from_tokens() {
        let summary = CssTokenSummary {
            definitions: vec![color_def("--color-danger", "#dc2626")],
            usage_by_token: vec![],
            unused_tokens: vec![],
        };
        let allow = ColorAllowlist::from_css_tokens(&summary);
        assert!(allow.is_allowed("#dc2626"));
        assert!(!allow.is_allowed("#ff0066"));
    }

    #[test]
    fn color_allowlist_resolves_var_chain() {
        let summary = CssTokenSummary {
            definitions: vec![
                color_def("--primary", "#93c5fd"),
                color_def("--color-primary", "var(--primary)"),
            ],
            usage_by_token: vec![],
            unused_tokens: vec![],
        };
        let allow = ColorAllowlist::from_css_tokens(&summary);
        assert!(allow.is_allowed("#93c5fd"));
    }

    #[test]
    fn size_scale_matches_tailwind_and_theme() {
        let summary = CssTokenSummary {
            definitions: vec![spacing_def("--spacing-layout-lg", "2rem")],
            usage_by_token: vec![],
            unused_tokens: vec![],
        };
        let scale = SizeScale::default_tailwind().extend_from_css_tokens(Some(&summary));
        assert_eq!(scale.match_size_utility("w", "80px").as_deref(), Some("w-20"));
        assert_eq!(
            scale.match_size_utility("w", "2rem").as_deref(),
            Some("w-layout-lg")
        );
        assert!(scale.match_size_utility("gap", "13px").is_none());
    }

    #[test]
    fn find_hardcoded_colors_respects_allowlist() {
        let summary = CssTokenSummary {
            definitions: vec![color_def("--color-danger", "#dc2626")],
            usage_by_token: vec![],
            unused_tokens: vec![],
        };
        let allow = ColorAllowlist::from_css_tokens(&summary);
        let found = find_hardcoded_colors_in_text("bg-[#dc2626] text-[#ff0066]", Some(&allow));
        assert_eq!(found, vec!["#ff0066".to_string()]);
    }

    #[test]
    fn arbitrary_utilities_parsed_from_class_string() {
        let utils = find_arbitrary_utilities_in_text("flex w-[80px] gap-[13px] shadow-[0_1px]");
        assert!(utils.iter().any(|(p, a)| p == "w" && a == "80px"));
        assert!(utils.iter().any(|(p, a)| p == "gap" && a == "13px"));
    }

    #[test]
    fn parse_style_string_extracts_colors() {
        let props = parse_style_string("color: #fff; width: 100px; background-color: #ff0066");
        assert_eq!(props.len(), 2);
        assert!(props.iter().any(|(p, v)| p == "color" && v == "#fff"));
        assert!(props
            .iter()
            .any(|(p, v)| p == "background-color" && v == "#ff0066"));
    }
}
