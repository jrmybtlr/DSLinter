//! Governance rules (MVP): duplicates, deprecation, tokens, accessibility, and code-quality heuristics.

mod config_filter;
mod dark_mode;
mod extracts;
mod scoring;
mod tokens;
mod usage;

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::config::DslintConfig;
use crate::css_tokens::{analyze_css_tokens, unused_css_var_findings};
use crate::directives::apply_inline_suppressions;
use crate::model::{FileScan, OwnershipSummary, ReportConfig, WorkspaceReport};
use crate::playground_emit::build_playground_specs;
use crate::util::paths::{path_matches_prefix, rel_path_from_canon_root};

use config_filter::filter_code_quality_config;
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
    files: Vec<FileScan>,
    sources: HashMap<PathBuf, String>,
    config: &DslintConfig,
) -> WorkspaceReport {
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
    findings.extend(variant_explosion_findings(&usage_by_component));
    findings.extend(duplicate_component_findings(&root, &duplicate_components));

    findings.extend(unused_props_findings(&files, &usage_by_component, config));

    let css_tokens = analyze_css_tokens(&root, &files, &sources, config);
    if let Some(ref summary) = css_tokens {
        findings.extend(unused_css_var_findings(summary, config));
    }

    findings = apply_inline_suppressions(findings, &sources);
    findings = filter_code_quality_config(findings, config);

    let ownership = compute_ownership(&root, &files, config);
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

    WorkspaceReport {
        root,
        files,
        findings,
        duplicate_components,
        usage_by_component,
        ownership,
        scores,
        playgrounds,
        css_tokens,
        config: report_config,
    }
}

fn compute_ownership(
    root: &Path,
    files: &[FileScan],
    config: &DslintConfig,
) -> Vec<OwnershipSummary> {
    let root_canon = std::fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let mut buckets: HashMap<String, (usize, usize)> = HashMap::new();

    for file in files {
        let rel = rel_path_from_canon_root(&root_canon, &file.path);
        let owner_label = config
            .ownership
            .iter()
            .find_map(|(label, prefixes)| {
                prefixes
                    .iter()
                    .find(|pre| path_matches_prefix(&rel, pre))
                    .map(|_| label.clone())
            })
            .unwrap_or_else(|| "unowned".to_string());

        let e = buckets.entry(owner_label).or_insert((0, 0));
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

#[cfg(test)]
mod ownership_tests {
    use std::collections::HashMap;

    use crate::util::paths::longest_matching_group;

    #[test]
    fn longest_matching_group_picks_nested_prefix() {
        let mut groups = HashMap::new();
        groups.insert("outer".into(), vec!["src/components".into()]);
        groups.insert("inner".into(), vec!["src/components/nested".into()]);
        let g = longest_matching_group("src/components/nested/Foo.tsx", &groups).unwrap();
        assert_eq!(g, "inner");
    }
}
