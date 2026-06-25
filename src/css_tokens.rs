//! CSS custom-property discovery, import resolution, and usage analysis.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::config::DslintConfig;
use crate::lazy_regex;
use crate::model::{
    CssTokenCategory, CssTokenDefinition, CssTokenScope, CssTokenSummary, CssTokenUsage,
    FileScan, LintFinding, Severity, UsageLocation,
};
use crate::scan::collect_css_files;

lazy_regex!(css_var_def_re, r"(--[a-zA-Z0-9][a-zA-Z0-9_-]*)\s*:\s*([^;]+);");
lazy_regex!(css_var_use_re, r"var\(\s*(--[a-zA-Z0-9][a-zA-Z0-9_-]*)");
lazy_regex!(css_import_re, r#"@import\s+(?:url\()?['"]?([^'")\s;]+)['"]?\)?"#);

fn is_framework_noise(name: &str) -> bool {
    name.starts_with("--tw-")
        || name.starts_with("--radix-")
        || name.starts_with("--animate-")
}

fn is_component_local_noise(name: &str, scope: CssTokenScope) -> bool {
    name.starts_with("--btn-") && scope == CssTokenScope::Selector
}

pub fn classify_token(name: &str) -> CssTokenCategory {
    if name.starts_with("--color-") {
        CssTokenCategory::Color
    } else if name.starts_with("--spacing-") {
        CssTokenCategory::Spacing
    } else if name.starts_with("--radius-") {
        CssTokenCategory::Radius
    } else if name.starts_with("--font-") {
        CssTokenCategory::Typography
    } else {
        CssTokenCategory::Other
    }
}

/// Load CSS sources from collected paths plus `@import` targets (one level of resolution per call, recursive overall).
pub fn load_css_sources(root: &Path, entry_paths: &[PathBuf]) -> HashMap<PathBuf, String> {
    let mut sources = HashMap::new();
    let mut visited = HashSet::new();
    let mut queue: Vec<PathBuf> = entry_paths.to_vec();

    while let Some(path) = queue.pop() {
        let canonical = path
            .canonicalize()
            .unwrap_or_else(|_| path.clone());
        if !visited.insert(canonical.clone()) {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&path) else {
            continue;
        };
        for import_spec in extract_imports(&content) {
            if let Some(resolved) = resolve_css_import(root, &path, &import_spec) {
                let resolved_canon = resolved
                    .canonicalize()
                    .unwrap_or_else(|_| resolved.clone());
                if !visited.contains(&resolved_canon) {
                    queue.push(resolved);
                }
            }
        }
        sources.insert(path, content);
    }

    sources
}

fn resolve_css_entry_paths(root: &Path, config: &DslintConfig) -> Vec<PathBuf> {
    if config.css_entrypoints.is_empty() {
        return collect_css_files(root, config).unwrap_or_default();
    }
    let mut out = Vec::new();
    for entry in &config.css_entrypoints {
        let trimmed = entry.trim();
        if trimmed.is_empty() {
            continue;
        }
        let path = root.join(trimmed);
        if path.is_file() {
            out.push(path);
        } else {
            eprintln!(
                "dslinter: css_entrypoints entry not found: {}",
                path.display()
            );
        }
    }
    out.sort();
    out.dedup();
    out
}

fn extract_imports(content: &str) -> Vec<String> {
    css_import_re()
        .captures_iter(content)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_string()))
        .collect()
}

fn dslinter_styles_filename(rest: &str) -> &str {
    if rest == "theme.css" {
        "dashboard-theme.css"
    } else {
        rest
    }
}

/// Walk `start` and its ancestors for an existing file.
fn find_file_in_ancestors(start: &Path, build: impl Fn(&Path) -> PathBuf) -> Option<PathBuf> {
    for base in start.ancestors() {
        let candidate = build(base);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn resolve_node_modules_import(anchors: &[&Path], spec: &str) -> Option<PathBuf> {
    let rel = spec.replace('/', std::path::MAIN_SEPARATOR_STR);
    for anchor in anchors {
        if let Some(path) =
            find_file_in_ancestors(anchor, |base| base.join("node_modules").join(&rel))
        {
            return Some(path);
        }
    }
    None
}

fn resolve_monorepo_dslinter_styles(anchors: &[&Path], rest: &str) -> Option<PathBuf> {
    let theme_file = dslinter_styles_filename(rest);
    for anchor in anchors {
        if let Some(path) = find_file_in_ancestors(anchor, |base| {
            base.join("packages")
                .join("dashboard")
                .join("src")
                .join("styles")
                .join(theme_file)
        }) {
            return Some(path);
        }
        if let Some(path) = find_file_in_ancestors(anchor, |base| {
            base.join("packages").join("dashboard").join(rest)
        }) {
            return Some(path);
        }
        if let Some(path) = find_file_in_ancestors(anchor, |base| {
            base.join("packages")
                .join("dashboard")
                .join("src")
                .join("styles")
                .join(rest)
        }) {
            return Some(path);
        }
    }
    None
}

/// Resolve `@import "…"` relative to the importing file or package name under `node_modules`.
pub fn resolve_css_import(root: &Path, from_file: &Path, spec: &str) -> Option<PathBuf> {
    let spec = spec.trim();
    if spec.is_empty() {
        return None;
    }

    if spec.starts_with("./") || spec.starts_with("../") {
        let base = from_file.parent()?;
        let candidate = base.join(spec);
        if candidate.is_file() {
            return Some(candidate);
        }
        return None;
    }

    let from_parent = from_file.parent().unwrap_or(root);
    let anchors = [root, from_parent];

    if let Some(path) = resolve_node_modules_import(&anchors, spec) {
        return Some(path);
    }

    // Package import: `dslinter/theme.css` → node_modules or monorepo package path.
    if let Some((pkg, rest)) = spec.split_once('/') {
        if pkg == "dslinter" {
            if let Some(path) = resolve_monorepo_dslinter_styles(&anchors, rest) {
                return Some(path);
            }
            let theme_file = dslinter_styles_filename(rest);
            if let Some(path) = find_file_in_ancestors(root, |base| {
                base.join("node_modules")
                    .join("dslinter")
                    .join("src")
                    .join("styles")
                    .join(theme_file)
            }) {
                return Some(path);
            }
        }
    }

    // Bare filename relative to scan root and ancestors (e.g. committed theme path).
    if let Some(path) = find_file_in_ancestors(root, |base| base.join(spec)) {
        return Some(path);
    }

    None
}

#[derive(Debug, Clone)]
struct RawDefinition {
    name: String,
    value: String,
    line: u32,
    scope: CssTokenScope,
}

fn detect_scope_context(line: &str, in_theme: bool) -> Option<CssTokenScope> {
    let trimmed = line.trim();
    if trimmed.starts_with("@theme") {
        return Some(CssTokenScope::Theme);
    }
    if trimmed.starts_with(":root") || trimmed == ":root {" {
        return Some(CssTokenScope::Root);
    }
    if in_theme {
        return Some(CssTokenScope::Theme);
    }
    if trimmed.starts_with('.') || trimmed.starts_with('#') || trimmed.starts_with('[') {
        return Some(CssTokenScope::Selector);
    }
    None
}

fn parse_definitions(_path: &Path, content: &str) -> Vec<RawDefinition> {
    let mut defs = Vec::new();
    let mut in_theme = false;
    let mut brace_depth = 0;
    let mut current_scope = CssTokenScope::Selector;

    for (line_idx, line) in content.lines().enumerate() {
        let line_no = (line_idx + 1) as u32;
        let trimmed = line.trim();

        if trimmed.starts_with("@theme") {
            in_theme = true;
            current_scope = CssTokenScope::Theme;
        }
        if let Some(scope) = detect_scope_context(line, in_theme) {
            current_scope = scope;
        }

        for cap in css_var_def_re().captures_iter(line) {
            let name = cap.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
            let value = cap
                .get(2)
                .map(|m| m.as_str().trim().to_string())
                .unwrap_or_default();
            if is_framework_noise(&name) {
                continue;
            }
            if is_component_local_noise(&name, current_scope) {
                continue;
            }
            defs.push(RawDefinition {
                name,
                value,
                line: line_no,
                scope: current_scope,
            });
        }

        brace_depth += trimmed.chars().filter(|&c| c == '{').count() as i32;
        brace_depth -= trimmed.chars().filter(|&c| c == '}').count() as i32;
        if in_theme && brace_depth <= 0 && trimmed.contains('}') {
            in_theme = false;
            current_scope = CssTokenScope::Selector;
        }
    }

    // Deduplicate per (name, scope) so :root and .dark can both define --background.
    let mut seen = HashSet::new();
    defs.retain(|d| seen.insert((d.name.clone(), d.scope)));
    defs
}

fn references_in_value(value: &str) -> Vec<String> {
    css_var_use_re()
        .captures_iter(value)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_string()))
        .collect()
}

fn collect_var_usages(_path: &Path, content: &str) -> Vec<(String, u32)> {
    let mut out = Vec::new();
    for (line_idx, line) in content.lines().enumerate() {
        let line_no = (line_idx + 1) as u32;
        for cap in css_var_use_re().captures_iter(line) {
            if let Some(name) = cap.get(1).map(|m| m.as_str().to_string()) {
                out.push((name, line_no));
            }
        }
    }
    out
}

/// Map Tailwind utility fragments to likely CSS custom properties when those defs exist.
fn class_tokens_to_css_vars(class_fragment: &str, known: &HashSet<String>) -> Vec<String> {
    let mut out = Vec::new();
    for class_name in class_fragment.split_whitespace() {
        let class_name = class_name.trim();
        if class_name.is_empty() {
            continue;
        }
        // Strip variant prefixes: dark:, hover:, sm:, etc.
        let base = class_name.rsplit(':').next().unwrap_or(class_name);
        let base = base.trim_start_matches('!');

        let candidates: Vec<String> = if let Some(rest) = base.strip_prefix("bg-") {
            vec![format!("--color-{rest}")]
        } else if let Some(rest) = base.strip_prefix("text-") {
            vec![format!("--color-{rest}")]
        } else if let Some(rest) = base.strip_prefix("border-") {
            vec![format!("--color-{rest}")]
        } else if let Some(rest) = base.strip_prefix("ring-") {
            vec![format!("--color-{rest}")]
        } else if let Some(rest) = base.strip_prefix("fill-") {
            vec![format!("--color-{rest}")]
        } else if let Some(rest) = base.strip_prefix("stroke-") {
            vec![format!("--color-{rest}")]
        } else if let Some(rest) = base.strip_prefix("from-") {
            vec![format!("--color-{rest}")]
        } else if let Some(rest) = base.strip_prefix("to-") {
            vec![format!("--color-{rest}")]
        } else if let Some(rest) = base.strip_prefix("via-") {
            vec![format!("--color-{rest}")]
        } else if let Some(rest) = base
            .strip_prefix("p-")
            .or_else(|| base.strip_prefix("m-"))
            .or_else(|| base.strip_prefix("gap-"))
            .or_else(|| base.strip_prefix("px-"))
            .or_else(|| base.strip_prefix("py-"))
            .or_else(|| base.strip_prefix("mx-"))
            .or_else(|| base.strip_prefix("my-"))
            .or_else(|| base.strip_prefix("pt-"))
            .or_else(|| base.strip_prefix("pb-"))
            .or_else(|| base.strip_prefix("pl-"))
            .or_else(|| base.strip_prefix("pr-"))
            .or_else(|| base.strip_prefix("mt-"))
            .or_else(|| base.strip_prefix("mb-"))
            .or_else(|| base.strip_prefix("ml-"))
            .or_else(|| base.strip_prefix("mr-"))
            .or_else(|| base.strip_prefix("space-x-"))
            .or_else(|| base.strip_prefix("space-y-"))
            .or_else(|| base.strip_prefix("inset-"))
            .or_else(|| base.strip_prefix("w-"))
            .or_else(|| base.strip_prefix("h-"))
            .or_else(|| base.strip_prefix("min-w-"))
            .or_else(|| base.strip_prefix("max-w-"))
            .or_else(|| base.strip_prefix("min-h-"))
            .or_else(|| base.strip_prefix("max-h-"))
            .or_else(|| base.strip_prefix("size-"))
        {
            vec![format!("--spacing-{rest}")]
        } else if let Some(rest) = base.strip_prefix("rounded-") {
            vec![format!("--radius-{rest}")]
        } else if let Some(rest) = base.strip_prefix("font-") {
            vec![format!("--font-{rest}")]
        } else {
            Vec::new()
        };

        for c in candidates {
            if known.contains(&c) {
                out.push(c);
            }
        }
    }
    out
}

pub fn analyze_css_tokens(
    root: &Path,
    files: &[FileScan],
    component_sources: &HashMap<PathBuf, String>,
    config: &DslintConfig,
) -> Option<CssTokenSummary> {
    let entry_paths = resolve_css_entry_paths(root, config);
    if entry_paths.is_empty() && component_sources.is_empty() {
        return None;
    }

    let css_sources = load_css_sources(root, &entry_paths);
    if css_sources.is_empty() {
        return None;
    }

    let mut raw_defs: Vec<(PathBuf, RawDefinition)> = Vec::new();
    for (path, content) in &css_sources {
        for d in parse_definitions(path, content) {
            raw_defs.push((path.clone(), d));
        }
    }

    if raw_defs.is_empty() {
        return None;
    }

    let def_names: HashSet<String> = raw_defs.iter().map(|(_, d)| d.name.clone()).collect();

    let definitions: Vec<CssTokenDefinition> = raw_defs
        .iter()
        .map(|(path, d)| CssTokenDefinition {
            name: d.name.clone(),
            value: d.value.clone(),
            category: classify_token(&d.name),
            scope: d.scope,
            path: path.clone(),
            line: d.line,
        })
        .collect();

    let mut usage_map: HashMap<String, Vec<UsageLocation>> = HashMap::new();

    let mut record_use = |name: String, path: &Path, line: u32| {
        if !def_names.contains(&name) {
            return;
        }
        usage_map
            .entry(name)
            .or_default()
            .push(UsageLocation {
                path: path.to_path_buf(),
                line,
                props: Vec::new(),
                prop_values: BTreeMap::new(),
            });
    };

    // var(--*) in all component + CSS sources
    let mut all_sources: HashMap<&PathBuf, &String> = HashMap::new();
    for (p, s) in component_sources {
        all_sources.insert(p, s);
    }
    for (p, s) in &css_sources {
        all_sources.insert(p, s);
    }

    for (path, content) in all_sources {
        for (name, line) in collect_var_usages(path, content) {
            record_use(name, path, line);
        }
    }

    // Tailwind classes from AST extracts
    for file in files {
        let Some(src) = component_sources.get(&file.path) else {
            continue;
        };
        for frag in &file.ast_extracts.class_strings {
            for name in class_tokens_to_css_vars(&frag.text, &def_names) {
                record_use(name, &file.path, frag.line);
            }
        }
        // Also scan raw source for class strings in template literals / unusual patterns
        let _ = src;
    }

    // Propagate transitive use via var() in definition values
    let value_by_name: HashMap<String, String> = raw_defs
        .iter()
        .map(|(_, d)| (d.name.clone(), d.value.clone()))
        .collect();

    let mut used: HashSet<String> = usage_map.keys().cloned().collect();
    let mut changed = true;
    while changed {
        changed = false;
        for (name, value) in &value_by_name {
            if used.contains(name) {
                continue;
            }
            for ref_name in references_in_value(value) {
                if used.contains(&ref_name) {
                    used.insert(name.clone());
                    changed = true;
                    break;
                }
            }
        }
    }

    let mut usage_by_token: Vec<CssTokenUsage> = Vec::new();
    for def in &definitions {
        let locs = usage_map.get(&def.name).cloned().unwrap_or_default();
        let reference_count = locs.len() as u32;
        let mut file_set: HashSet<PathBuf> = HashSet::new();
        for loc in &locs {
            file_set.insert(loc.path.clone());
        }
        let mut files_list: Vec<PathBuf> = file_set.into_iter().collect();
        files_list.sort();
        usage_by_token.push(CssTokenUsage {
            name: def.name.clone(),
            reference_count,
            file_count: files_list.len() as u32,
            files: files_list,
            usage_locations: locs,
        });
    }
    usage_by_token.sort_by(|a, b| a.name.cmp(&b.name));

    let unused_tokens: Vec<String> = definitions
        .iter()
        .filter(|d| {
            matches!(d.scope, CssTokenScope::Theme | CssTokenScope::Root)
                && !used.contains(&d.name)
        })
        .map(|d| d.name.clone())
        .collect();

    Some(CssTokenSummary {
        definitions,
        usage_by_token,
        unused_tokens,
    })
}

pub fn unused_css_var_findings(
    summary: &CssTokenSummary,
    config: &DslintConfig,
) -> Vec<LintFinding> {
    if !config.check_unused_css_tokens {
        return Vec::new();
    }

    summary
        .unused_tokens
        .iter()
        .filter_map(|name| {
            let def = summary.definitions.iter().find(|d| &d.name == name)?;
            Some(LintFinding {
                rule_id: "token-unused-css-var".into(),
                message: format!(
                    "CSS custom property `{name}` is defined but never referenced in scanned sources."
                ),
                path: def.path.clone(),
                line: Some(def.line),
                severity: Severity::Info,
                variant_label: None,
            })
        })
        .collect()
}

pub fn token_adoption_from_css(summary: &CssTokenSummary) -> Option<u8> {
    let theme_root: Vec<_> = summary
        .definitions
        .iter()
        .filter(|d| matches!(d.scope, CssTokenScope::Theme | CssTokenScope::Root))
        .collect();
    if theme_root.is_empty() {
        return None;
    }
    let used_names: HashSet<String> = summary
        .usage_by_token
        .iter()
        .filter(|u| u.reference_count > 0)
        .map(|u| u.name.clone())
        .collect();

    // Include transitive use
    let value_by_name: HashMap<String, String> = summary
        .definitions
        .iter()
        .map(|d| (d.name.clone(), d.value.clone()))
        .collect();
    let mut used = used_names;
    let mut changed = true;
    while changed {
        changed = false;
        for (name, value) in &value_by_name {
            if used.contains(name) {
                continue;
            }
            for ref_name in references_in_value(value) {
                if used.contains(&ref_name) {
                    used.insert(name.clone());
                    changed = true;
                    break;
                }
            }
        }
    }

    let hits = theme_root.iter().filter(|d| used.contains(&d.name)).count();
    Some(((hits * 100) / theme_root.len()).min(100) as u8)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn parses_theme_and_root_vars() {
        let css = r#"
@theme {
  --color-primary: #2563eb;
  --spacing-layout-md: 1.5rem;
}
:root {
  --background: oklch(1 0 0);
}
.btn {
  --btn-bg: red;
}
"#;
        let defs = parse_definitions(Path::new("t.css"), css);
        let names: HashSet<_> = defs.iter().map(|d| d.name.as_str()).collect();
        assert!(names.contains("--color-primary"));
        assert!(names.contains("--spacing-layout-md"));
        assert!(names.contains("--background"));
        assert!(!names.contains("--btn-bg"));
    }

    #[test]
    fn keeps_dark_selector_overrides_alongside_root() {
        let css = r#"
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}
"#;
        let defs = parse_definitions(Path::new("t.css"), css);
        let background: Vec<_> = defs
            .iter()
            .filter(|d| d.name == "--background")
            .map(|d| (d.scope, d.value.as_str()))
            .collect();
        assert_eq!(background.len(), 2);
        assert!(background.contains(&(CssTokenScope::Root, "oklch(1 0 0)")));
        assert!(background.contains(&(CssTokenScope::Selector, "oklch(0.145 0 0)")));
    }

    #[test]
    fn skips_tw_noise() {
        let css = ":root { --tw-gray-50: 248 250 252; --color-surface: #fff; }";
        let defs = parse_definitions(Path::new("t.css"), css);
        assert_eq!(defs.len(), 1);
        assert_eq!(defs[0].name, "--color-surface");
    }

    #[test]
    fn resolves_package_import_from_repo_root() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let from = root.join("demo/src/index.css");
        let resolved = resolve_css_import(&root, &from, "dslinter/theme.css");
        assert!(resolved.is_some(), "expected monorepo theme path");
        assert!(resolved.unwrap().ends_with("dashboard-theme.css"));
    }

    #[test]
    fn resolves_package_import_from_demo_scan_root() {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let root = manifest.join("demo/react");
        let from = root.join("src/index.css");
        let resolved = resolve_css_import(&root, &from, "dslinter/theme.css");
        assert!(
            resolved.is_some(),
            "demo scan root should resolve theme via parent monorepo path"
        );
        assert!(resolved.unwrap().ends_with("dashboard-theme.css"));
    }

    #[test]
    fn class_maps_to_color_token() {
        let known: HashSet<String> = ["--color-primary".into()].into_iter().collect();
        let vars = class_tokens_to_css_vars("bg-primary hover:bg-primary/90", &known);
        assert!(vars.iter().any(|v| v == "--color-primary"));
    }

    #[test]
    fn css_entrypoints_limit_loaded_css_sources() {
        let tmp = tempdir().unwrap();
        let root = tmp.path();
        std::fs::create_dir_all(root.join("styles")).unwrap();
        std::fs::write(
            root.join("styles/main.css"),
            ":root { --color-main: #111; } .a { color: var(--color-main); }",
        )
        .unwrap();
        std::fs::write(root.join("styles/other.css"), ":root { --color-other: #222; }").unwrap();

        let config = DslintConfig {
            css_entrypoints: vec!["styles/main.css".into()],
            ..Default::default()
        };
        let entry = resolve_css_entry_paths(root, &config);
        let rels: Vec<_> = entry
            .iter()
            .filter_map(|p| p.strip_prefix(root).ok())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .collect();
        assert_eq!(rels, vec!["styles/main.css"]);
    }
}
