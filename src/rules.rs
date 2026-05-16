//! Governance rules (MVP): duplicates, deprecation, tokens, accessibility, and code-quality heuristics (`smell-*`).

use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use regex::Regex;

use crate::config::DslintConfig;
use crate::directives::{apply_inline_suppressions, collect_workspace_sources};
use crate::lines::{line_of_offset, newline_offsets};
use crate::model::{
    DuplicateComponent, FileScan, GovernanceScores, LintFinding, OwnershipSummary, Severity,
    UsageLocation, UsageSummary, WorkspaceReport,
};
use crate::playground_emit::build_playground_specs;

// ── Static regex helpers ─────────────────────────────────────────────────────

fn hex_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b").expect("hex regex")
    })
}

fn tw_arbitrary_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"\[(?:#[0-9a-fA-F]{3,8}|\d+px)\]").expect("tw arb regex")
    })
}

fn class_attr_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?:class|className)\s*=\s*["']([^"']+)["']"#).expect("class attr regex")
    })
}

fn class_helper_attr_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?:class|className)\s*=\s*\{\s*(?:cn|clsx|classnames)\(([^}]*)\)\s*\}"#)
            .expect("class helper attr regex")
    })
}

fn quoted_literal_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r#"["']([^"']+)["']"#).expect("quoted literal regex"))
}

pub fn evaluate_workspace(
    root: PathBuf,
    files: Vec<FileScan>,
    config: &DslintConfig,
) -> WorkspaceReport {
    // Read every source file once and reuse the text throughout this function,
    // eliminating duplicate disk reads across rules.
    let sources = collect_workspace_sources(&root, &files);

    let mut findings = Vec::new();
    for file in &files {
        findings.extend(file.findings.iter().cloned());
    }
    findings.extend(hardcoded_hex_colors(&files, &sources));
    findings.extend(tailwind_arbitrary_tokens(&files, &sources));
    findings.extend(dark_mode_contrast_findings(&files, &sources, config));
    dedupe_token_color_overlap(&mut findings);
    findings.extend(deprecated_usage(&files, config));

    let duplicate_components = duplicate_definitions(&files);
    let usage_by_component = rollup_usage(&files);
    findings.extend(variant_explosion_hints(&usage_by_component));
    for dup in &duplicate_components {
        findings.push(LintFinding {
            rule_id: "duplicate-component".into(),
            message: format!(
                "Component `{}` is defined in {} files — consolidate or alias.",
                dup.name,
                dup.locations.len()
            ),
            path: dup
                .locations
                .first()
                .cloned()
                .unwrap_or_else(|| root.clone()),
            line: None,
            severity: Severity::Warning,
        });
    }

    findings.extend(unused_props_findings(&files, &usage_by_component, config));

    findings = apply_inline_suppressions(findings, &sources);
    findings = filter_smell_config(findings, config);

    let ownership = compute_ownership(&root, &files, config);

    let scores = compute_scores(&findings, &duplicate_components, &files, config, &sources);

    let playgrounds = build_playground_specs(&root, &files, config);

    WorkspaceReport {
        root,
        files,
        findings,
        duplicate_components,
        usage_by_component,
        ownership,
        scores,
        playgrounds,
    }
}

fn rollup_usage(files: &[FileScan]) -> Vec<UsageSummary> {
    // per-component → per-file → count
    let mut map: HashMap<String, HashMap<PathBuf, u32>> =
        HashMap::with_capacity(files.len());
    let mut max_props: HashMap<String, usize> = HashMap::with_capacity(files.len());
    let mut prop_freqs: HashMap<String, BTreeMap<String, u32>> =
        HashMap::with_capacity(files.len());
    let mut prop_value_freqs: HashMap<String, BTreeMap<String, BTreeMap<String, u32>>> =
        HashMap::with_capacity(files.len());
    let mut locs: HashMap<String, Vec<UsageLocation>> = HashMap::with_capacity(files.len());

    for file in files {
        for u in &file.usages {
            let per_file = map.entry(u.component.clone()).or_default();
            *per_file.entry(file.path.clone()).or_insert(0) += 1;

            let entry = max_props.entry(u.component.clone()).or_insert(0);
            *entry = (*entry).max(u.props.len());

            let pf = prop_freqs.entry(u.component.clone()).or_default();
            for prop in &u.props {
                *pf.entry(prop.clone()).or_insert(0) += 1;
            }

            if !u.prop_values.is_empty() {
                let pvf = prop_value_freqs.entry(u.component.clone()).or_default();
                for (prop, value) in &u.prop_values {
                    *pvf.entry(prop.clone())
                        .or_default()
                        .entry(value.clone())
                        .or_insert(0) += 1;
                }
            }

            locs.entry(u.component.clone())
                .or_default()
                .push(UsageLocation {
                    path: file.path.clone(),
                    line: u.line,
                    props: u.props.clone(),
                    prop_values: u.prop_values.clone(),
                });
        }
    }

    let mut rows: Vec<UsageSummary> = map
        .into_iter()
        .map(|(component, files_map)| {
            let mut paths: Vec<PathBuf> = files_map.keys().cloned().collect();
            paths.sort();
            let reference_count: u32 = files_map.values().sum();
            let prop_frequencies = prop_freqs.remove(&component).unwrap_or_default();
            let prop_value_frequencies =
                prop_value_freqs.remove(&component).unwrap_or_default();
            let mut usage_locations = locs.remove(&component).unwrap_or_default();
            usage_locations.sort_by(|a, b| {
                a.path.cmp(&b.path).then_with(|| a.line.cmp(&b.line))
            });
            UsageSummary {
                component: component.clone(),
                reference_count,
                file_count: paths.len(),
                max_props_on_single_use: max_props.remove(&component).unwrap_or(0),
                files: paths,
                prop_frequencies,
                prop_value_frequencies,
                usage_locations,
            }
        })
        .collect();
    rows.sort_by(|a, b| {
        b.reference_count
            .cmp(&a.reference_count)
            .then_with(|| a.component.cmp(&b.component))
    });
    rows
}

fn variant_explosion_hints(rows: &[UsageSummary]) -> Vec<LintFinding> {
    const THRESHOLD: usize = 14;
    let mut out = Vec::new();
    for row in rows {
        if row.max_props_on_single_use < THRESHOLD {
            continue;
        }
        let Some(path) = row.files.first().cloned() else {
            continue;
        };
        out.push(LintFinding {
            rule_id: "variant-explosion".into(),
            message: format!(
                "`{}` reached {} props on a single tag — consider splitting variants or using composition.",
                row.component, row.max_props_on_single_use
            ),
            path,
            line: None,
            severity: Severity::Info,
        });
    }
    out
}

fn definition_paths_by_name(files: &[FileScan]) -> HashMap<String, Vec<PathBuf>> {
    let mut map: HashMap<String, Vec<PathBuf>> = HashMap::new();
    for file in files {
        for def in &file.definitions {
            if def.name == "default" || def.name.starts_with("default→") {
                continue;
            }
            map.entry(def.name.clone())
                .or_default()
                .push(file.path.clone());
        }
    }
    for paths in map.values_mut() {
        paths.sort();
        paths.dedup();
    }
    map
}

fn duplicate_definitions(files: &[FileScan]) -> Vec<DuplicateComponent> {
    let mut out = Vec::new();
    for (name, locations) in definition_paths_by_name(files) {
        if locations.len() > 1 {
            out.push(DuplicateComponent { name, locations });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

fn is_code_quality_rule(rule_id: &str) -> bool {
    rule_id.starts_with("code-") || rule_id.starts_with("smell-")
}

/// `smell-*` config entries also match `code-*` rule ids (and vice versa).
fn code_rule_aliases(rule_id: &str) -> Vec<String> {
    if let Some(suffix) = rule_id.strip_prefix("code-") {
        vec![rule_id.to_string(), format!("smell-{suffix}")]
    } else if let Some(suffix) = rule_id.strip_prefix("smell-") {
        vec![rule_id.to_string(), format!("code-{suffix}")]
    } else {
        vec![rule_id.to_string()]
    }
}

fn filter_smell_config(mut findings: Vec<LintFinding>, config: &DslintConfig) -> Vec<LintFinding> {
    findings.retain(|f| {
        if (f.rule_id == "code-console-error" || f.rule_id == "smell-console-error")
            && !config.smell.report_console_error
        {
            return false;
        }
        if is_code_quality_rule(&f.rule_id) {
            let aliases = code_rule_aliases(&f.rule_id);
            return !config
                .smell
                .disabled_rules
                .iter()
                .any(|pat| aliases.iter().any(|id| rule_pattern_matches(pat, id)));
        }
        true
    });
    findings
}

fn rule_pattern_matches(pat: &str, rule_id: &str) -> bool {
    if pat == "*" {
        return true;
    }
    if let Some(prefix) = pat.strip_suffix('*') {
        return rule_id.starts_with(prefix);
    }
    pat == rule_id
}

fn compute_ownership(
    root: &Path,
    files: &[FileScan],
    config: &DslintConfig,
) -> Vec<OwnershipSummary> {
    let root_canon = std::fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let mut buckets: HashMap<String, (usize, usize)> = HashMap::new();

    for file in files {
        let rel = file
            .path
            .strip_prefix(&root_canon)
            .ok()
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();

        let mut owner_label: Option<String> = None;
        for (label, prefixes) in &config.ownership {
            for pre in prefixes {
                let pre = pre.trim().trim_start_matches('/').trim_end_matches('/');
                if pre.is_empty() {
                    continue;
                }
                if rel == pre || rel.starts_with(&format!("{pre}/")) {
                    owner_label = Some(label.clone());
                    break;
                }
            }
            if owner_label.is_some() {
                break;
            }
        }

        let label = owner_label.unwrap_or_else(|| "unowned".to_string());
        let e = buckets.entry(label).or_insert((0, 0));
        e.0 += 1;
        e.1 += file.definitions.len();
    }

    let mut out: Vec<OwnershipSummary> = buckets
        .into_iter()
        .map(|(owner, (files, definitions))| OwnershipSummary {
            owner,
            files,
            definitions,
        })
        .collect();
    out.sort_by(|a, b| a.owner.cmp(&b.owner));
    out
}

fn tailwind_arbitrary_in_text(path: &Path, line: u32, text: &str) -> Vec<LintFinding> {
    let re = tw_arbitrary_re();
    let mut out = Vec::new();
    for m in re.find_iter(text) {
        out.push(LintFinding {
            rule_id: "token-tailwind-arbitrary".into(),
            message: format!("Tailwind arbitrary value `{}`", m.as_str()),
            path: path.to_path_buf(),
            line: Some(line),
            severity: Severity::Info,
        });
    }
    out
}

fn tailwind_arbitrary_tokens(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
) -> Vec<LintFinding> {
    let mut out = Vec::new();
    for file in files {
        if !file.ast_extracts.is_empty() {
            for lit in &file.ast_extracts.string_literals {
                out.extend(tailwind_arbitrary_in_text(
                    &file.path,
                    lit.line,
                    &lit.value,
                ));
            }
            for cls in &file.ast_extracts.class_strings {
                out.extend(tailwind_arbitrary_in_text(
                    &file.path,
                    cls.line,
                    &cls.text,
                ));
            }
        } else if let Some(text) = sources.get(&file.path) {
            let newlines = newline_offsets(text);
            for m in tw_arbitrary_re().find_iter(text) {
                let line = line_of_offset(&newlines, m.start());
                out.extend(tailwind_arbitrary_in_text(
                    &file.path,
                    line,
                    m.as_str(),
                ));
            }
        }
    }
    out
}

/// When Tailwind arbitrary brackets contain a hex (`[#rgb]`), both `token-tailwind-arbitrary` and
/// `token-hardcoded-color` can fire on the same line — keep the Tailwind rule only.
fn dedupe_token_color_overlap(findings: &mut Vec<LintFinding>) {
    let mut tw_lines: HashSet<(PathBuf, u32)> = HashSet::new();
    for f in findings.iter() {
        if f.rule_id == "token-tailwind-arbitrary" {
            if let Some(ln) = f.line {
                tw_lines.insert((f.path.clone(), ln));
            }
        }
    }
    findings.retain(|f| {
        if f.rule_id != "token-hardcoded-color" {
            return true;
        }
        match f.line {
            Some(ln) => !tw_lines.contains(&(f.path.clone(), ln)),
            None => true,
        }
    });
}

fn deprecated_usage(files: &[FileScan], config: &DslintConfig) -> Vec<LintFinding> {
    let banned: HashSet<_> = config.deprecated_components.iter().cloned().collect();
    if banned.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    for file in files {
        for u in &file.usages {
            if banned.contains(&u.component) {
                out.push(LintFinding {
                    rule_id: "deprecated-component".into(),
                    message: format!(
                        "Deprecated component `{}` is still referenced.",
                        u.component
                    ),
                    path: file.path.clone(),
                    line: Some(u.line),
                    severity: Severity::Warning,
                });
            }
        }
    }
    out
}

fn hex_color_findings_in_text(path: &Path, line: u32, text: &str) -> Vec<LintFinding> {
    let re = hex_re();
    let mut out = Vec::new();
    for m in re.find_iter(text) {
        out.push(LintFinding {
            rule_id: "token-hardcoded-color".into(),
            message: format!("Hardcoded color `{}`", m.as_str()),
            path: path.to_path_buf(),
            line: Some(line),
            severity: Severity::Info,
        });
    }
    out
}

fn hardcoded_hex_colors(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
) -> Vec<LintFinding> {
    let mut out = Vec::new();
    for file in files {
        if !file.ast_extracts.is_empty() {
            for lit in &file.ast_extracts.string_literals {
                out.extend(hex_color_findings_in_text(
                    &file.path,
                    lit.line,
                    &lit.value,
                ));
            }
            for cls in &file.ast_extracts.class_strings {
                out.extend(hex_color_findings_in_text(
                    &file.path,
                    cls.line,
                    &cls.text,
                ));
            }
        } else if let Some(text) = sources.get(&file.path) {
            let newlines = newline_offsets(text);
            for m in hex_re().find_iter(text) {
                let line = line_of_offset(&newlines, m.start());
                out.extend(hex_color_findings_in_text(
                    &file.path,
                    line,
                    m.as_str(),
                ));
            }
        }
    }
    out
}

fn is_probable_color_utility(rest: &str, non_color_words: &[&str]) -> bool {
    if rest.is_empty() {
        return false;
    }
    if rest.starts_with('[') {
        // Arbitrary Tailwind values can include colors (`text-[#fff]`, `bg-[var(--x)]`).
        return true;
    }
    if non_color_words.contains(&rest) {
        return false;
    }
    true
}

fn is_probable_text_color_class(token: &str) -> bool {
    let Some(rest) = token.strip_prefix("text-") else {
        return false;
    };
    const NON_COLOR_TEXT: &[&str] = &[
        "xs",
        "sm",
        "base",
        "lg",
        "xl",
        "2xl",
        "3xl",
        "4xl",
        "5xl",
        "6xl",
        "7xl",
        "8xl",
        "9xl",
        "left",
        "center",
        "right",
        "justify",
        "start",
        "end",
        "ellipsis",
        "clip",
        "balance",
        "pretty",
        "wrap",
        "nowrap",
    ];
    is_probable_color_utility(rest, NON_COLOR_TEXT)
}

fn is_probable_bg_color_class(token: &str) -> bool {
    let Some(rest) = token.strip_prefix("bg-") else {
        return false;
    };
    const NON_COLOR_BG_KEYS: &[&str] = &[
        "clip",
        "origin",
        "blend",
        "gradient",
        "repeat",
        "no-repeat",
        "fixed",
        "local",
        "scroll",
        "center",
        "top",
        "bottom",
        "left",
        "right",
        "cover",
        "contain",
        "none",
        "auto",
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
    out.push(LintFinding {
        rule_id: "a11y-dark-mode-contrast".into(),
        message: dark_mode_contrast_message().into(),
        path: path.to_path_buf(),
        line: Some(line),
        severity: Severity::Info,
    });
}

fn dark_mode_contrast_findings(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
    config: &DslintConfig,
) -> Vec<LintFinding> {
    if !config.check_dark_mode_contrast {
        return Vec::new();
    }

    let mut out = Vec::new();
    for file in files {
        if !file.ast_extracts.class_strings.is_empty() {
            for cls in &file.ast_extracts.class_strings {
                if has_dark_mode_contrast_issue(&cls.text) {
                    push_dark_mode_finding(&mut out, &file.path, cls.line);
                }
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
            if !has_dark_mode_contrast_issue(classes) {
                continue;
            }
            push_dark_mode_finding(
                &mut out,
                &file.path,
                line_of_offset(&newlines, full.start()),
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
            if all_classes.is_empty() || !has_dark_mode_contrast_issue(&all_classes) {
                continue;
            }
            push_dark_mode_finding(
                &mut out,
                &file.path,
                line_of_offset(&newlines, full.start()),
            );
        }
    }
    out
}

fn a11y_penalty(findings: &[LintFinding]) -> i32 {
    findings
        .iter()
        .filter(|f| f.rule_id.starts_with("a11y-"))
        .map(|f| match f.severity {
            Severity::Error => 6_i32,
            Severity::Warning => 4_i32,
            Severity::Info => 2_i32,
        })
        .sum()
}

fn smell_penalty(findings: &[LintFinding]) -> i32 {
    findings
        .iter()
        .filter(|f| is_code_quality_rule(&f.rule_id))
        .count()
        .min(25) as i32
}

fn compute_scores(
    findings: &[LintFinding],
    duplicates: &[DuplicateComponent],
    files: &[FileScan],
    config: &DslintConfig,
    sources: &HashMap<PathBuf, String>,
) -> GovernanceScores {
    let warn = findings
        .iter()
        .filter(|f| f.severity == Severity::Warning)
        .count() as i32;
    let dup_penalty = duplicates.len() as i32 * 5;

    let token_adoption = token_adoption_pct(files, config, sources);
    let maintainability =
        (100_i32 - warn * 3 - dup_penalty - smell_penalty(findings)).clamp(0, 100) as u8;
    let accessibility = (100_i32 - a11y_penalty(findings)).clamp(0, 100) as u8;
    let ux_consistency = (100_i32 - warn * 2).clamp(0, 100) as u8;

    let mut pillars = vec![
        maintainability as i32,
        accessibility as i32,
        ux_consistency as i32,
    ];
    if let Some(t) = token_adoption {
        pillars.push(t as i32);
    }
    let design_system_health =
        (pillars.iter().sum::<i32>() / pillars.len() as i32).clamp(0, 100) as u8;

    GovernanceScores {
        design_system_health,
        ux_consistency,
        accessibility,
        maintainability,
    }
}

/// Share of files that reference at least one configured token string (None if unset).
fn token_adoption_pct(
    files: &[FileScan],
    config: &DslintConfig,
    sources: &HashMap<PathBuf, String>,
) -> Option<u8> {
    if config.known_tokens.is_empty() {
        return None;
    }
    let mut hits = 0_u32;
    for file in files {
        let Some(text) = sources.get(&file.path) else {
            continue;
        };
        if config
            .known_tokens
            .iter()
            .any(|t| text.contains(t.as_str()))
        {
            hits += 1;
        }
    }
    if files.is_empty() {
        return Some(100);
    }
    Some(((hits * 100) / files.len() as u32).min(100) as u8)
}

/// Props that are implicit or universal in React; skip them in unused-prop analysis.
const IMPLICIT_PROPS: &[&str] = &["children", "className", "style", "key", "ref"];
fn unused_props_findings(
    files: &[FileScan],
    usage_map: &[UsageSummary],
    config: &DslintConfig,
) -> Vec<LintFinding> {
    if !config.check_unused_props {
        return Vec::new();
    }

    // Build: component name → (definition file path, declared props).
    // First definition wins; skip anonymous/default exports.
    let mut def_map: HashMap<String, (PathBuf, Vec<String>)> = HashMap::new();
    for file in files {
        for def in &file.definitions {
            // Skip default-export placeholders — they are imported under a different
            // local name at each call site, so we can never match usages by name.
            if def.name == "default" || def.name.starts_with("default→") {
                continue;
            }
            if def.declared_props.is_empty() {
                continue;
            }
            def_map
                .entry(def.name.clone())
                .or_insert_with(|| (file.path.clone(), def.declared_props.clone()));
        }
    }

    // Build a quick lookup: component name → prop_frequencies.
    let freq_map: HashMap<&str, &BTreeMap<String, u32>> = usage_map
        .iter()
        .map(|u| (u.component.as_str(), &u.prop_frequencies))
        .collect();

    let empty_freq = BTreeMap::new();
    let mut out = Vec::new();
    let mut keys: Vec<&String> = def_map.keys().collect();
    keys.sort(); // deterministic output order
    for component in keys {
        let (path, declared) = &def_map[component];
        let freq = freq_map.get(component.as_str()).copied().unwrap_or(&empty_freq);
        for prop in declared {
            // Skip implicit/universal React props.
            if IMPLICIT_PROPS.contains(&prop.as_str()) {
                continue;
            }
            let count = freq.get(prop).copied().unwrap_or(0);
            if count == 0 {
                out.push(LintFinding {
                    rule_id: "unused-prop".into(),
                    message: format!(
                        "`{component}` prop `{prop}` is declared but never passed at any call site."
                    ),
                    path: path.clone(),
                    line: None,
                    severity: Severity::Info,
                });
            }
        }
    }
    out
}

#[cfg(test)]
mod token_ast_tests {
    use super::*;
    use crate::ecma::analyze_ecma_file;
    use std::path::Path;

    #[test]
    fn hex_in_comment_not_reported_via_ast() {
        let path = Path::new("token_ast_comment.tsx");
        let src = r#"
// #ffffff should not be a finding
export function Box() {
  return <div className="ok">x</motion.div>;
}
"#;
        let file = analyze_ecma_file(path, src);
        let mut sources = HashMap::new();
        sources.insert(path.to_path_buf(), src.to_string());
        let findings = hardcoded_hex_colors(std::slice::from_ref(&file), &sources);
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
        let findings = hardcoded_hex_colors(std::slice::from_ref(&file), &sources);
        assert!(
            findings.iter().any(|f| f.message.contains("#ff00aa")),
            "expected hex in string literal: {:?}",
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
            LintFinding {
                rule_id: "token-hardcoded-color".into(),
                message: "hex".into(),
                path: p.clone(),
                line: Some(10),
                severity: Severity::Info,
            },
            LintFinding {
                rule_id: "token-tailwind-arbitrary".into(),
                message: "arb".into(),
                path: p.clone(),
                line: Some(10),
                severity: Severity::Info,
            },
            LintFinding {
                rule_id: "token-hardcoded-color".into(),
                message: "hex2".into(),
                path: p.clone(),
                line: Some(11),
                severity: Severity::Info,
            },
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

#[cfg(test)]
mod prop_tests {
    use super::*;
    use crate::model::{ComponentDefinition, DefinitionKind, FileScan, JsxUsage};
    use std::path::PathBuf;

    fn make_file(
        path: &str,
        defs: Vec<(&str, Vec<&str>)>,
        usages: Vec<(&str, Vec<&str>)>,
    ) -> FileScan {
        FileScan {
            path: PathBuf::from(path),
            definitions: defs
                .into_iter()
                .map(|(name, props)| ComponentDefinition {
                    name: name.to_string(),
                    kind: DefinitionKind::Function,
                    line: 1,
                    declared_props: props.into_iter().map(|s| s.to_string()).collect(),
                })
                .collect(),
            usages: usages
                .into_iter()
                .map(|(comp, props)| JsxUsage {
                    component: comp.to_string(),
                    line: 5,
                    props: props.into_iter().map(|s| s.to_string()).collect(),
                    prop_values: std::collections::BTreeMap::new(),
                })
                .collect(),
            parse_errors: Vec::new(),
            findings: Vec::new(),
            ast_extracts: Default::default(),
        }
    }

    #[test]
    fn rollup_captures_prop_frequencies() {
        let files = vec![
            make_file(
                "a.tsx",
                vec![],
                vec![("Button", vec!["variant", "size"]), ("Button", vec!["variant"])],
            ),
            make_file("b.tsx", vec![], vec![("Button", vec!["variant", "onClick"])]),
        ];
        let rows = rollup_usage(&files);
        let btn = rows.iter().find(|r| r.component == "Button").unwrap();
        assert_eq!(btn.reference_count, 3);
        assert_eq!(*btn.prop_frequencies.get("variant").unwrap(), 3);
        assert_eq!(*btn.prop_frequencies.get("size").unwrap(), 1);
        assert_eq!(*btn.prop_frequencies.get("onClick").unwrap(), 1);
    }

    #[test]
    fn rollup_records_usage_locations() {
        let files = vec![make_file(
            "x.tsx",
            vec![],
            vec![("Card", vec!["title"]), ("Card", vec!["title", "body"])],
        )];
        let rows = rollup_usage(&files);
        let card = rows.iter().find(|r| r.component == "Card").unwrap();
        assert_eq!(card.usage_locations.len(), 2);
        assert_eq!(card.usage_locations[0].props, vec!["title"]);
    }

    #[test]
    fn unused_props_finds_never_passed_prop() {
        let files = vec![
            make_file(
                "Btn.tsx",
                vec![("Button", vec!["variant", "disabled", "onClick"])],
                vec![],
            ),
            // Callers only pass `variant` and `onClick`.
            make_file(
                "page.tsx",
                vec![],
                vec![("Button", vec!["variant", "onClick"])],
            ),
        ];
        let config = DslintConfig {
            check_unused_props: true,
            ..Default::default()
        };
        let usage_map = rollup_usage(&files);
        let findings = unused_props_findings(&files, &usage_map, &config);
        // `disabled` should be flagged; `variant` and `onClick` should not.
        assert!(
            findings
                .iter()
                .any(|f| f.rule_id == "unused-prop" && f.message.contains("disabled")),
            "{:?}",
            findings
        );
        assert!(
            !findings
                .iter()
                .any(|f| f.rule_id == "unused-prop" && f.message.contains("variant")),
            "variant is used so should not be flagged"
        );
    }

    #[test]
    fn unused_props_off_by_default() {
        let files = vec![
            make_file("Btn.tsx", vec![("Button", vec!["unused"])], vec![]),
        ];
        let config = DslintConfig::default(); // check_unused_props = false
        let usage_map = rollup_usage(&files);
        let findings = unused_props_findings(&files, &usage_map, &config);
        assert!(findings.is_empty());
    }

    #[test]
    fn unused_props_skips_children_and_classname() {
        let files = vec![
            make_file(
                "Wrap.tsx",
                vec![("Wrapper", vec!["children", "className", "style", "extra"])],
                vec![],
            ),
        ];
        let config = DslintConfig {
            check_unused_props: true,
            ..Default::default()
        };
        let usage_map = rollup_usage(&files);
        let findings = unused_props_findings(&files, &usage_map, &config);
        // children/className/style are skipped; only `extra` should fire.
        assert_eq!(findings.len(), 1, "{findings:?}");
        assert!(findings[0].message.contains("extra"));
    }
}

#[cfg(test)]
mod dark_mode_contrast_tests {
    use super::*;
    use crate::model::FileScan;
    use std::path::PathBuf;

    fn file(path: &str) -> FileScan {
        FileScan {
            path: PathBuf::from(path),
            definitions: Vec::new(),
            usages: Vec::new(),
            parse_errors: Vec::new(),
            findings: Vec::new(),
            ast_extracts: Default::default(),
        }
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
