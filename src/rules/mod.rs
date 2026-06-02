//! Governance rules (MVP): duplicates, deprecation, tokens, accessibility, and code-quality heuristics.

mod a11y_cva;
mod config_filter;
mod dark_mode;
mod extracts;
mod scoring;
mod tokens;
mod usage;

use std::collections::HashMap;
use std::path::PathBuf;

use crate::config::DslintConfig;
use crate::css_tokens::{analyze_css_tokens, unused_css_var_findings};
use crate::directives::apply_inline_suppressions;
use crate::model::{
    ConfigSnapshot, FileScan, ReportConfig, WorkspaceReport, WORKSPACE_REPORT_SCHEMA_VERSION,
    utc_rfc3339_now,
};
use crate::playground_emit::build_playground_specs;

use config_filter::filter_code_quality_config;
use a11y_cva::{cva_composed_dark_mode_findings, cva_skip_fragments_for_files};
use dark_mode::dark_mode_contrast_findings;
use scoring::compute_scores;
use tokens::{
    dedupe_token_color_overlap, deprecated_usage, hardcoded_hex_colors, tailwind_arbitrary_tokens,
};
use usage::{
    duplicate_component_findings, duplicate_definitions, rollup_usage, unused_props_findings,
    variant_explosion_findings,
};

pub fn evaluate_workspace(
    root: PathBuf,
    mut files: Vec<FileScan>,
    sources: HashMap<PathBuf, String>,
    config: &DslintConfig,
) -> WorkspaceReport {
    let mut findings = Vec::new();
    for file in &files {
        findings.extend(file.findings.iter().cloned());
    }
    findings.extend(hardcoded_hex_colors(&files, &sources));
    findings.extend(tailwind_arbitrary_tokens(&files, &sources));
    let cva_skip = cva_skip_fragments_for_files(&files, &sources);
    findings.extend(cva_composed_dark_mode_findings(&files, &sources, config));
    findings.extend(dark_mode_contrast_findings(
        &files,
        &sources,
        config,
        &cva_skip,
    ));
    dedupe_token_color_overlap(&mut findings);
    findings.extend(deprecated_usage(&files, config));

    let duplicate_components = duplicate_definitions(&files);
    let usage_by_component = rollup_usage(&files);
    findings.extend(variant_explosion_findings(&usage_by_component));
    findings.extend(duplicate_component_findings(&root, &duplicate_components));

    findings.extend(unused_props_findings(&files, &usage_by_component, config));

    let css_tokens = analyze_css_tokens(&root, &files, &sources, config);
    if let Some(ref summary) = css_tokens {
        findings.extend(unused_css_var_findings(summary, config));
    }

    findings = apply_inline_suppressions(findings, &sources);
    findings = filter_code_quality_config(findings, config);

    let scores = compute_scores(
        &findings,
        &duplicate_components,
        &files,
        config,
        &sources,
        css_tokens.as_ref(),
    );
    let playgrounds = build_playground_specs(&root, &files, config);

    let report_config = ReportConfig {
        hidden_components: config.hidden_components.clone(),
        hidden_paths: config.hidden_paths.clone(),
    };

    let config_snapshot = ConfigSnapshot {
        deprecated_components: config.deprecated_components.clone(),
        known_tokens: config.known_tokens.clone(),
        include_dirs: config.include_dirs.clone(),
    };

    for file in &mut files {
        file.usages.clear();
        file.findings.clear();
    }

    WorkspaceReport {
        schema_version: WORKSPACE_REPORT_SCHEMA_VERSION,
        generated_at: utc_rfc3339_now(),
        root,
        files,
        findings,
        duplicate_components,
        usage_by_component,
        scores,
        playgrounds,
        css_tokens,
        config: report_config,
        config_snapshot,
    }
}
