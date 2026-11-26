//! Roll up hardcoded colors, Tailwind arbitrary values, and inline styles by use count so
//! repeated values can be promoted to design tokens.

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::model::{
    CssTokenCategory, CssTokenSummary, FileScan, SourceLocation, TokenCandidate,
    TokenCandidateKind, TokenCandidateSummary,
};
use crate::rules::extracts::{for_each_ast_text, for_each_class_string, for_each_source_regex};
use crate::token_values::{
    find_hardcoded_colors_in_text, is_color_utility_prefix, is_size_utility_prefix,
    is_style_color_property, parse_css_color, ColorAllowlist, SizeScale,
};
use crate::util::regex::hex_re;

/// A value used at least this many times is recommended as a token.
pub const RECOMMEND_MIN_USES: u32 = 2;
const MAX_LOCATIONS: usize = 10;

#[derive(Default)]
struct Bucket {
    category: Option<CssTokenCategory>,
    use_instead: Option<String>,
    sites: BTreeSet<SourceLocation>,
}

#[derive(Default)]
struct Tally {
    buckets: BTreeMap<String, Bucket>,
}

impl Tally {
    fn add(
        &mut self,
        value: String,
        category: CssTokenCategory,
        use_instead: Option<String>,
        path: &Path,
        line: u32,
    ) {
        let b = self.buckets.entry(value).or_default();
        b.category.get_or_insert(category);
        if b.use_instead.is_none() {
            b.use_instead = use_instead;
        }
        b.sites.insert(SourceLocation {
            path: path.to_path_buf(),
            line,
        });
    }

    fn finish(self, kind: TokenCandidateKind) -> Vec<TokenCandidate> {
        let mut out: Vec<TokenCandidate> = self
            .buckets
            .into_iter()
            .map(|(value, b)| {
                let files: Vec<PathBuf> = b
                    .sites
                    .iter()
                    .map(|s| s.path.clone())
                    .collect::<BTreeSet<_>>()
                    .into_iter()
                    .collect();
                let category = b.category.unwrap_or(CssTokenCategory::Other);
                TokenCandidate {
                    kind,
                    category,
                    reference_count: b.sites.len() as u32,
                    file_count: files.len() as u32,
                    files,
                    locations: b.sites.into_iter().take(MAX_LOCATIONS).collect(),
                    use_instead: b.use_instead,
                    suggested_token: None,
                    recommended: false,
                    value,
                }
            })
            .collect();
        out.sort_by(|a, b| {
            b.reference_count
                .cmp(&a.reference_count)
                .then(b.file_count.cmp(&a.file_count))
                .then(a.value.cmp(&b.value))
        });
        out
    }
}

pub fn collect_token_candidates(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
    css_tokens: Option<&CssTokenSummary>,
    color_allowlist: Option<&ColorAllowlist>,
    size_scale: &SizeScale,
) -> TokenCandidateSummary {
    // Colors: literals, class strings, inline style values, regex fallback.
    let mut colors = Tally::default();
    let mut push_colors = |path: &Path, line: u32, text: &str| {
        for hex in find_hardcoded_colors_in_text(text, None) {
            let existing = color_allowlist
                .and_then(|a| a.token_for_color(&hex))
                .map(str::to_string);
            colors.add(hex, CssTokenCategory::Color, existing, path, line);
        }
    };
    for_each_ast_text(files, &mut push_colors);
    for file in files {
        for style in &file.ast_extracts.style_values {
            push_colors(&file.path, style.line, &style.value);
        }
    }
    for_each_source_regex(files, sources, hex_re, &mut push_colors);

    // Tailwind arbitrary values.
    let mut classes = Tally::default();
    for_each_class_string(files, sources, |path, line, text| {
        for class in text.split_whitespace() {
            if let Some((value, category, use_instead)) =
                arbitrary_class(class, size_scale, color_allowlist)
            {
                classes.add(value, category, use_instead, path, line);
            }
        }
    });

    // Inline style declarations.
    let mut styles = Tally::default();
    for file in files {
        for style in &file.ast_extracts.style_values {
            let prop = kebab_property(&style.property);
            let value = style.value.trim();
            if value.is_empty() || value.contains("var(") {
                continue;
            }
            let value = if is_length_property(&prop) && value.parse::<f64>().is_ok() && value != "0"
            {
                format!("{value}px")
            } else {
                value.to_string()
            };
            let category = style_category(&prop);
            let use_instead = if category == CssTokenCategory::Color {
                parse_css_color(&value)
                    .and_then(|hex| color_allowlist.and_then(|a| a.token_for_color(&hex)))
                    .map(str::to_string)
            } else {
                None
            };
            styles.add(
                format!("{prop}: {value}"),
                category,
                use_instead,
                &file.path,
                style.line,
            );
        }
    }

    let mut summary = TokenCandidateSummary {
        colors: colors.finish(TokenCandidateKind::Color),
        arbitrary_classes: classes.finish(TokenCandidateKind::ArbitraryClass),
        inline_styles: styles.finish(TokenCandidateKind::InlineStyle),
    };
    assign_suggestions(&mut summary, css_tokens);
    summary
}

/// `hover:md:w-[13px]` → (`w-[13px]`, Spacing, Some(`w-3`?)).
fn arbitrary_class(
    class: &str,
    size_scale: &SizeScale,
    color_allowlist: Option<&ColorAllowlist>,
) -> Option<(String, CssTokenCategory, Option<String>)> {
    let base = strip_variants(class)
        .trim_start_matches('!')
        .trim_end_matches('!');
    if !base.ends_with(']') {
        return None;
    }
    // Arbitrary property: `[mask-type:alpha]`.
    if let Some(inner) = base.strip_prefix('[').and_then(|s| s.strip_suffix(']')) {
        let (prop, value) = inner.split_once(':')?;
        if value.contains("var(") || prop.starts_with('&') || prop.starts_with('@') {
            return None;
        }
        return Some((base.to_string(), style_category(prop), None));
    }
    let open = base.find("-[")?;
    let prefix = base[..open].trim_start_matches('-');
    let value = &base[open + 2..base.len() - 1];
    if prefix.is_empty() || value.is_empty() || value.contains("var(") || value.starts_with("--") {
        return None;
    }
    let value = if value.starts_with('#') {
        value.to_ascii_lowercase()
    } else {
        value.to_string()
    };
    let value = value.as_str();
    let normalized = format!("{prefix}-[{value}]");
    let category = class_category(prefix, value);
    let use_instead = if category == CssTokenCategory::Color {
        color_allowlist
            .and_then(|a| a.token_for_color(value))
            .map(str::to_string)
    } else {
        size_scale.match_size_utility(prefix, value)
    };
    Some((normalized, category, use_instead))
}

/// Drop Tailwind variants (`hover:`, `[&_svg]:`) — colons inside brackets/parens don't count.
fn strip_variants(class: &str) -> &str {
    let mut depth = 0i32;
    let mut start = 0;
    for (i, ch) in class.char_indices() {
        match ch {
            '[' | '(' => depth += 1,
            ']' | ')' => depth -= 1,
            ':' if depth == 0 => start = i + 1,
            _ => {}
        }
    }
    &class[start..]
}

fn class_category(prefix: &str, value: &str) -> CssTokenCategory {
    let looks_color = value.starts_with('#')
        || value.starts_with("rgb")
        || value.starts_with("hsl")
        || value.starts_with("oklch")
        || value.starts_with("color:");
    if looks_color && (is_color_utility_prefix(prefix) || prefix.starts_with("border-")) {
        return CssTokenCategory::Color;
    }
    if prefix.starts_with("rounded") {
        return CssTokenCategory::Radius;
    }
    if matches!(prefix, "text" | "font" | "leading" | "tracking") {
        return CssTokenCategory::Typography;
    }
    if is_size_utility_prefix(prefix)
        || matches!(
            prefix,
            "top"
                | "right"
                | "bottom"
                | "left"
                | "inset-x"
                | "inset-y"
                | "translate-x"
                | "translate-y"
                | "gap-x"
                | "gap-y"
                | "ps"
                | "pe"
                | "ms"
                | "me"
                | "basis"
        )
    {
        return CssTokenCategory::Spacing;
    }
    CssTokenCategory::Other
}

fn kebab_property(prop: &str) -> String {
    let mut out = String::with_capacity(prop.len() + 4);
    for ch in prop.chars() {
        if ch.is_ascii_uppercase() {
            out.push('-');
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push(ch);
        }
    }
    out
}

fn is_length_property(prop: &str) -> bool {
    style_category(prop) == CssTokenCategory::Spacing
        || matches!(prop, "border-radius" | "font-size" | "letter-spacing")
}

fn style_category(prop: &str) -> CssTokenCategory {
    if is_style_color_property(prop) || prop.ends_with("-color") {
        return CssTokenCategory::Color;
    }
    if prop.contains("radius") {
        return CssTokenCategory::Radius;
    }
    if prop.starts_with("font") || prop == "line-height" || prop == "letter-spacing" {
        return CssTokenCategory::Typography;
    }
    let spacing = prop.starts_with("padding")
        || prop.starts_with("margin")
        || prop.ends_with("width")
        || prop.ends_with("height")
        || prop.contains("gap")
        || matches!(prop, "top" | "right" | "bottom" | "left" | "inset");
    if spacing {
        return CssTokenCategory::Spacing;
    }
    CssTokenCategory::Other
}

/// Fill `suggested_token` / `recommended`, keeping proposed names unique.
fn assign_suggestions(summary: &mut TokenCandidateSummary, css_tokens: Option<&CssTokenSummary>) {
    let mut taken: HashSet<String> = css_tokens
        .map(|s| s.definitions.iter().map(|d| d.name.clone()).collect())
        .unwrap_or_default();
    let mut by_value: HashMap<(CssTokenCategory, String), String> = HashMap::new();

    let lists = [
        &mut summary.colors,
        &mut summary.arbitrary_classes,
        &mut summary.inline_styles,
    ];
    for list in lists {
        for c in list.iter_mut() {
            c.recommended = c.reference_count >= RECOMMEND_MIN_USES;
            if c.use_instead.is_some() {
                continue;
            }
            let Some((raw_value, base)) = suggest_name(c) else {
                continue;
            };
            // Same underlying value across lists (e.g. `#fff` in a class and a style) shares a name.
            let key = (c.category, raw_value);
            if let Some(existing) = by_value.get(&key) {
                c.suggested_token = Some(existing.clone());
                continue;
            }
            let mut name = base.clone();
            let mut n = 2;
            while taken.contains(&name) {
                name = format!("{base}-{n}");
                n += 1;
            }
            taken.insert(name.clone());
            by_value.insert(key, name.clone());
            c.suggested_token = Some(name);
        }
    }
}

/// Returns (raw value used for de-duplication, proposed CSS variable name).
fn suggest_name(c: &TokenCandidate) -> Option<(String, String)> {
    let raw = match c.kind {
        TokenCandidateKind::Color => c.value.clone(),
        TokenCandidateKind::ArbitraryClass => {
            let v = c
                .value
                .rsplit_once("-[")
                .map(|(_, v)| v)
                .unwrap_or(&c.value);
            let v = v.trim_start_matches('[').trim_end_matches(']');
            v.rsplit_once(':').map(|(_, v)| v).unwrap_or(v).to_string()
        }
        TokenCandidateKind::InlineStyle => c.value.split_once(": ")?.1.to_string(),
    };
    let name = match c.category {
        CssTokenCategory::Color => {
            let hex = parse_css_color(&raw)?;
            let name = format!("--color-{}", color_name(&hex)?);
            return Some((hex, name));
        }
        CssTokenCategory::Spacing => format!("--spacing-{}", slug(&raw)?),
        CssTokenCategory::Radius => format!("--radius-{}", slug(&raw)?),
        CssTokenCategory::Typography => {
            let prefix = typography_prefix(&c.value);
            format!("--{prefix}-{}", slug(&raw)?)
        }
        CssTokenCategory::Other => {
            if c.value.starts_with("shadow-") || c.value.starts_with("box-shadow") {
                format!("--shadow-{}", c.reference_count)
            } else {
                return None;
            }
        }
    };
    Some((raw, name))
}

fn typography_prefix(value: &str) -> &'static str {
    if value.starts_with("leading") || value.starts_with("line-height") {
        "leading"
    } else if value.starts_with("tracking") || value.starts_with("letter-spacing") {
        "tracking"
    } else if value.starts_with("font-weight") || value.starts_with("font-[") {
        "font-weight"
    } else {
        "text"
    }
}

/// `13px` → `13px`, `1.5rem` → `1_5rem`; skip expressions.
fn slug(value: &str) -> Option<String> {
    let v = value.trim();
    if v.is_empty() || !v.chars().any(|c| c.is_ascii_digit()) {
        return None;
    }
    if !v
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
    {
        return None;
    }
    Some(v.replace('.', "_"))
}

/// `#2563eb` → `blue-600` (hue family + Tailwind-like lightness step).
pub fn color_name(hex: &str) -> Option<String> {
    let h = hex.trim_start_matches('#');
    if h.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&h[0..2], 16).ok()? as f64 / 255.0;
    let g = u8::from_str_radix(&h[2..4], 16).ok()? as f64 / 255.0;
    let b = u8::from_str_radix(&h[4..6], 16).ok()? as f64 / 255.0;
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let l = (max + min) / 2.0;
    if l >= 0.99 {
        return Some("white".into());
    }
    if l <= 0.01 {
        return Some("black".into());
    }
    let d = max - min;
    let s = if d == 0.0 {
        0.0
    } else {
        d / (1.0 - (2.0 * l - 1.0).abs())
    };
    let hue = if d == 0.0 {
        0.0
    } else if max == r {
        60.0 * (((g - b) / d).rem_euclid(6.0))
    } else if max == g {
        60.0 * ((b - r) / d + 2.0)
    } else {
        60.0 * ((r - g) / d + 4.0)
    };
    let family = if s < 0.12 {
        "gray"
    } else {
        match hue {
            h if h < 15.0 => "red",
            h if h < 40.0 => "orange",
            h if h < 65.0 => "yellow",
            h if h < 90.0 => "lime",
            h if h < 160.0 => "green",
            h if h < 185.0 => "teal",
            h if h < 205.0 => "cyan",
            h if h < 245.0 => "blue",
            h if h < 275.0 => "indigo",
            h if h < 300.0 => "purple",
            h if h < 335.0 => "pink",
            _ => "red",
        }
    };
    let step = (((1.0 - l) * 10.0).round() as i32 * 100).clamp(50, 950);
    let step = if step == 0 { 50 } else { step };
    Some(format!("{family}-{step}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ecma::analyze_ecma_file;

    fn summarize(src: &str) -> TokenCandidateSummary {
        let path = Path::new("cands.tsx");
        let file = analyze_ecma_file(path, src);
        let mut sources = HashMap::new();
        sources.insert(path.to_path_buf(), src.to_string());
        collect_token_candidates(
            std::slice::from_ref(&file),
            &sources,
            None,
            None,
            &SizeScale::default_tailwind(),
        )
    }

    #[test]
    fn counts_repeated_hex_and_recommends() {
        let s = summarize(
            r##"
export function A() {
  const a = "#2563eb";
  const b = "#2563EB";
  const c = "#123456";
  return <div style={{ color: "#2563eb" }} />;
}
"##,
        );
        let blue = s.colors.iter().find(|c| c.value == "#2563eb").unwrap();
        assert_eq!(blue.reference_count, 3, "{:?}", s.colors);
        assert!(blue.recommended);
        assert_eq!(blue.suggested_token.as_deref(), Some("--color-blue-500"));
        let once = s.colors.iter().find(|c| c.value == "#123456").unwrap();
        assert!(!once.recommended);
        assert_eq!(s.colors[0].value, "#2563eb", "sorted by count");
    }

    #[test]
    fn counts_arbitrary_classes_across_variants() {
        let s = summarize(
            r#"
export function A() {
  return (
    <>
      <div className="w-[13px] hover:w-[13px] rounded-[7px] w-[80px]" />
      <div className="md:w-[13px] [mask-type:alpha]" />
    </>
  );
}
"#,
        );
        let w = s
            .arbitrary_classes
            .iter()
            .find(|c| c.value == "w-[13px]")
            .unwrap();
        assert_eq!(
            w.reference_count, 2,
            "one per line: {:?}",
            s.arbitrary_classes
        );
        assert_eq!(w.category, CssTokenCategory::Spacing);
        assert_eq!(w.suggested_token.as_deref(), Some("--spacing-13px"));
        let w80 = s
            .arbitrary_classes
            .iter()
            .find(|c| c.value == "w-[80px]")
            .unwrap();
        assert_eq!(w80.use_instead.as_deref(), Some("w-20"));
        assert!(s
            .arbitrary_classes
            .iter()
            .any(|c| c.value == "rounded-[7px]" && c.category == CssTokenCategory::Radius));
        assert!(s
            .arbitrary_classes
            .iter()
            .any(|c| c.value == "[mask-type:alpha]"));
    }

    #[test]
    fn counts_inline_style_declarations() {
        let s = summarize(
            r#"
export function A() {
  return (
    <>
      <div style={{ padding: 13, borderRadius: "6px" }} />
      <div style={{ padding: "13px" }} />
    </>
  );
}
"#,
        );
        let pad = s
            .inline_styles
            .iter()
            .find(|c| c.value == "padding: 13px")
            .unwrap();
        assert_eq!(pad.reference_count, 2, "{:?}", s.inline_styles);
        assert!(pad.recommended);
        assert!(s
            .inline_styles
            .iter()
            .any(|c| c.value == "border-radius: 6px" && c.category == CssTokenCategory::Radius));
    }

    #[test]
    fn color_names() {
        assert_eq!(color_name("#ffffff").as_deref(), Some("white"));
        assert_eq!(color_name("#6b7280").as_deref(), Some("gray-500"));
        assert_eq!(color_name("#dc2626").as_deref(), Some("red-500"));
    }
}
