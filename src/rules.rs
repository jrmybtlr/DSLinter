//! Governance rules (MVP): duplicates, deprecation, tokens, and accessibility (JSX AST + Vue template).

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use regex::Regex;

use crate::config::DslintConfig;
use crate::model::{
    DuplicateComponent, FileScan, GovernanceScores, LintFinding, Severity, UsageSummary,
    WorkspaceReport,
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

    let scores = compute_scores(&findings, &duplicate_components, &files, config);

    WorkspaceReport {
        root,
        files,
        findings,
        duplicate_components,
        usage_by_component,
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
    let maintainability = (100_i32 - warn * 3 - dup_penalty).clamp(0, 100) as u8;
    let accessibility = (100_i32 - a11y_penalty(findings)).clamp(0, 100) as u8;
    let ux_consistency = (100_i32 - warn * 2).clamp(0, 100) as u8;
    let design_system_health = ((token_adoption as i32
        + maintainability as i32
        + accessibility as i32
        + ux_consistency as i32)
        / 4)
    .clamp(0, 100) as u8;

    GovernanceScores {
        design_system_health,
        ux_consistency,
        accessibility,
        maintainability,
    }
}

/// Rough token adoption: share of files that reference at least one configured token string.
fn token_adoption_pct(files: &[FileScan], config: &DslintConfig) -> u8 {
    if config.known_tokens.is_empty() {
        return 75;
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
        return 100;
    }
    ((hits * 100) / files.len() as u32).min(100) as u8
}
