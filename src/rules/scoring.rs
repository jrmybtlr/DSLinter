//! Governance score computation.

use std::collections::HashMap;
use std::path::PathBuf;

use crate::config::DslintConfig;
use crate::css_tokens::token_adoption_from_css;
use crate::model::{CssTokenSummary, DuplicateComponent, FileScan, GovernanceScores, LintFinding, Severity};
use crate::rules::config_filter::is_code_quality_rule;

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

fn code_quality_penalty(findings: &[LintFinding]) -> i32 {
    findings
        .iter()
        .filter(|f| is_code_quality_rule(&f.rule_id))
        .count()
        .min(25) as i32
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
        let has_token = if !file.ast_extracts.is_empty() {
            // Fast path: search already-extracted string literals and class strings.
            let in_strings = file.ast_extracts.string_literals.iter().any(|f| {
                config.known_tokens.iter().any(|t| f.value.contains(t.as_str()))
            });
            let in_classes = file.ast_extracts.class_strings.iter().any(|f| {
                config.known_tokens.iter().any(|t| f.text.contains(t.as_str()))
            });
            in_strings || in_classes
        } else {
            // Fallback: scan raw source text.
            let Some(text) = sources.get(&file.path) else {
                continue;
            };
            config.known_tokens.iter().any(|t| text.contains(t.as_str()))
        };
        if has_token {
            hits += 1;
        }
    }
    if files.is_empty() {
        return Some(100);
    }
    Some(((hits * 100) / files.len() as u32).min(100) as u8)
}

pub fn compute_scores(
    findings: &[LintFinding],
    duplicates: &[DuplicateComponent],
    files: &[FileScan],
    config: &DslintConfig,
    sources: &HashMap<PathBuf, String>,
    css_tokens: Option<&CssTokenSummary>,
) -> GovernanceScores {
    let warn = findings
        .iter()
        .filter(|f| f.severity == Severity::Warning)
        .count() as i32;
    let err = findings
        .iter()
        .filter(|f| f.severity == Severity::Error)
        .count() as i32;
    let dup_penalty = duplicates.len() as i32 * 5;

    let token_adoption = css_tokens
        .and_then(token_adoption_from_css)
        .or_else(|| token_adoption_pct(files, config, sources));
    let maintainability =
        (100_i32 - warn * 3 - dup_penalty - code_quality_penalty(findings)).clamp(0, 100) as u8;
    let accessibility = (100_i32 - a11y_penalty(findings)).clamp(0, 100) as u8;
    let ux_consistency = (100_i32 - warn * 2 - err * 3).clamp(0, 100) as u8;

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
