//! Governance rules (MVP): duplicates, deprecation, tokens, accessibility, and code smells.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use regex::Regex;

use crate::config::DslintConfig;
use crate::directives::{apply_inline_suppressions, collect_workspace_sources};
use crate::model::{
    DuplicateComponent, FileScan, GovernanceScores, LintFinding, OwnershipSummary, Severity,
    UsageSummary, WorkspaceReport,
};

pub fn evaluate_workspace(
    root: PathBuf,
    files: Vec<FileScan>,
    config: &DslintConfig,
) -> WorkspaceReport {
    let mut findings = Vec::new();
    for file in &files {
        findings.extend(file.findings.iter().cloned());
    }
    findings.extend(hardcoded_hex_colors(&files));
    findings.extend(tailwind_arbitrary_tokens(&files));
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

    let sources = collect_workspace_sources(&root, &files);
    findings = apply_inline_suppressions(findings, &sources);
    findings = filter_smell_config(findings, config);

    let ownership = compute_ownership(&root, &files, config);

    let scores = compute_scores(&findings, &duplicate_components, &files, config);

    WorkspaceReport {
        root,
        files,
        findings,
        duplicate_components,
        usage_by_component,
        ownership,
        scores,
    }
}

fn rollup_usage(files: &[FileScan]) -> Vec<UsageSummary> {
    let mut map: HashMap<String, HashMap<PathBuf, u32>> = HashMap::new();
    let mut max_props: HashMap<String, usize> = HashMap::new();
    for file in files {
        for u in &file.usages {
            let per_file = map.entry(u.component.clone()).or_default();
            *per_file.entry(file.path.clone()).or_insert(0) += 1;
            let entry = max_props.entry(u.component.clone()).or_insert(0);
            *entry = (*entry).max(u.props.len());
        }
    }
    let mut rows: Vec<UsageSummary> = map
        .into_iter()
        .map(|(component, files_map)| {
            let mut paths: Vec<PathBuf> = files_map.keys().cloned().collect();
            paths.sort();
            let reference_count: u32 = files_map.values().sum();
            UsageSummary {
                component: component.clone(),
                reference_count,
                file_count: paths.len(),
                max_props_on_single_use: max_props.remove(&component).unwrap_or(0),
                files: paths,
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

fn filter_smell_config(mut findings: Vec<LintFinding>, config: &DslintConfig) -> Vec<LintFinding> {
    findings.retain(|f| {
        if f.rule_id == "smell-console-error" && !config.smell.report_console_error {
            return false;
        }
        if f.rule_id.starts_with("smell-") {
            return !config
                .smell
                .disabled_rules
                .iter()
                .any(|pat| rule_pattern_matches(pat, &f.rule_id));
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

fn tailwind_arbitrary_tokens(files: &[FileScan]) -> Vec<LintFinding> {
    let re = Regex::new(r"\[(?:#[0-9a-fA-F]{3,8}|\d+px)\]").expect("tw arb regex");
    let mut out = Vec::new();
    for file in files {
        let Ok(text) = std::fs::read_to_string(&file.path) else {
            continue;
        };
        for m in re.find_iter(&text) {
            let start = m.start();
            let line = 1 + text[..start].bytes().filter(|&b| b == b'\n').count() as u32;
            out.push(LintFinding {
                rule_id: "token-tailwind-arbitrary".into(),
                message: format!(
                    "Tailwind arbitrary value `{}` — prefer theme tokens or extended config keys.",
                    m.as_str()
                ),
                path: file.path.clone(),
                line: Some(line),
                severity: Severity::Info,
            });
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

fn hardcoded_hex_colors(files: &[FileScan]) -> Vec<LintFinding> {
    let re = Regex::new(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b").expect("hex regex");
    let mut out = Vec::new();
    for file in files {
        let Ok(text) = std::fs::read_to_string(&file.path) else {
            continue;
        };
        for m in re.find_iter(&text) {
            let start = m.start();
            let line = 1 + text[..start].bytes().filter(|&b| b == b'\n').count() as u32;
            out.push(LintFinding {
                rule_id: "token-hardcoded-color".into(),
                message: format!(
                    "Hardcoded color `{}` — prefer design tokens or theme variables.",
                    m.as_str()
                ),
                path: file.path.clone(),
                line: Some(line),
                severity: Severity::Info,
            });
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
        .filter(|f| f.rule_id.starts_with("smell-"))
        .count()
        .min(25) as i32
}

fn compute_scores(
    findings: &[LintFinding],
    duplicates: &[DuplicateComponent],
    files: &[FileScan],
    config: &DslintConfig,
) -> GovernanceScores {
    let warn = findings
        .iter()
        .filter(|f| f.severity == Severity::Warning)
        .count() as i32;
    let dup_penalty = duplicates.len() as i32 * 5;

    let token_adoption = token_adoption_pct(files, config);
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
fn token_adoption_pct(files: &[FileScan], config: &DslintConfig) -> Option<u8> {
    if config.known_tokens.is_empty() {
        return None;
    }
    let mut hits = 0_u32;
    for file in files {
        let Ok(text) = std::fs::read_to_string(&file.path) else {
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
