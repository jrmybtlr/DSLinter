//! Component usage rollup, duplicates, and unused-prop analysis.

use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};

use crate::config::DslintConfig;
use crate::model::{
    DuplicateComponent, FileScan, LintFinding, Severity, UsageLocation, UsageSummary,
};

fn is_playground_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.contains(".playground."))
}

/// Accumulator for all per-component data gathered during a single pass over usages.
struct ComponentAccumulator {
    files_map: HashMap<PathBuf, u32>,
    max_props: usize,
    prop_freqs: BTreeMap<String, u32>,
    prop_value_freqs: BTreeMap<String, BTreeMap<String, u32>>,
    locs: Vec<UsageLocation>,
}

impl ComponentAccumulator {
    fn new() -> Self {
        Self {
            files_map: HashMap::new(),
            max_props: 0,
            prop_freqs: BTreeMap::new(),
            prop_value_freqs: BTreeMap::new(),
            locs: Vec::new(),
        }
    }
}

pub fn rollup_usage(files: &[FileScan]) -> Vec<UsageSummary> {
    let mut acc: HashMap<String, ComponentAccumulator> = HashMap::with_capacity(files.len());

    for file in files {
        if is_playground_file(&file.path) {
            continue;
        }
        for u in &file.usages {
            let entry = acc.entry(u.component.clone()).or_insert_with(ComponentAccumulator::new);

            *entry.files_map.entry(file.path.clone()).or_insert(0) += 1;
            entry.max_props = entry.max_props.max(u.props.len());

            for prop in &u.props {
                *entry.prop_freqs.entry(prop.clone()).or_insert(0) += 1;
            }

            if !u.prop_values.is_empty() {
                for (prop, value) in &u.prop_values {
                    *entry
                        .prop_value_freqs
                        .entry(prop.clone())
                        .or_default()
                        .entry(value.clone())
                        .or_insert(0) += 1;
                }
            }

            entry.locs.push(UsageLocation {
                path: file.path.clone(),
                line: u.line,
                props: u.props.clone(),
                prop_values: u.prop_values.clone(),
            });
        }
    }

    let mut rows: Vec<UsageSummary> = acc
        .into_iter()
        .map(|(component, mut a)| {
            let mut paths: Vec<PathBuf> = a.files_map.keys().cloned().collect();
            paths.sort();
            let reference_count: u32 = a.files_map.values().sum();
            a.locs.sort_by(|x, y| x.path.cmp(&y.path).then_with(|| x.line.cmp(&y.line)));
            UsageSummary {
                component,
                reference_count,
                file_count: paths.len(),
                max_props_on_single_use: a.max_props,
                files: paths,
                prop_frequencies: a.prop_freqs,
                prop_value_frequencies: a.prop_value_freqs,
                usage_locations: a.locs,
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
        out.push(LintFinding::new(
            "variant-explosion",
            path,
            None,
            Severity::Info,
            format!(
                "`{}` reached {} props on a single tag — consider splitting variants or using composition.",
                row.component, row.max_props_on_single_use
            ),
        ));
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

pub fn duplicate_definitions(files: &[FileScan]) -> Vec<DuplicateComponent> {
    let mut out = Vec::new();
    for (name, locations) in definition_paths_by_name(files) {
        if locations.len() > 1 {
            out.push(DuplicateComponent { name, locations });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    out
}

pub fn duplicate_component_findings(
    root: &Path,
    duplicates: &[DuplicateComponent],
) -> Vec<LintFinding> {
    duplicates
        .iter()
        .map(|dup| {
            LintFinding::new(
                "duplicate-component",
                dup.locations
                    .first()
                    .cloned()
                    .unwrap_or_else(|| root.to_path_buf()),
                None,
                Severity::Warning,
                format!(
                    "Component `{}` is defined in {} files — consolidate or alias.",
                    dup.name,
                    dup.locations.len()
                ),
            )
        })
        .collect()
}

/// Props that are implicit or universal in React; skip them in unused-prop analysis.
const IMPLICIT_PROPS: &[&str] = &["children", "className", "style", "key", "ref"];

pub fn unused_props_findings(
    files: &[FileScan],
    usage_map: &[UsageSummary],
    config: &DslintConfig,
) -> Vec<LintFinding> {
    if !config.check_unused_props {
        return Vec::new();
    }

    let mut def_map: HashMap<String, (PathBuf, Vec<String>)> = HashMap::new();
    for file in files {
        for def in &file.definitions {
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

    let freq_map: HashMap<&str, &BTreeMap<String, u32>> = usage_map
        .iter()
        .map(|u| (u.component.as_str(), &u.prop_frequencies))
        .collect();

    let empty_freq = BTreeMap::new();
    let mut out = Vec::new();
    let mut keys: Vec<&String> = def_map.keys().collect();
    keys.sort();
    for component in keys {
        let (path, declared) = &def_map[component];
        let freq = freq_map.get(component.as_str()).copied().unwrap_or(&empty_freq);
        for prop in declared {
            if IMPLICIT_PROPS.contains(&prop.as_str()) {
                continue;
            }
            let count = freq.get(prop).copied().unwrap_or(0);
            if count == 0 {
                out.push(LintFinding::new(
                    "unused-prop",
                    path.clone(),
                    None,
                    Severity::Info,
                    format!(
                        "`{component}` prop `{prop}` is declared but never passed at any call site."
                    ),
                ));
            }
        }
    }
    out
}

pub fn variant_explosion_findings(rows: &[UsageSummary]) -> Vec<LintFinding> {
    variant_explosion_hints(rows)
}

#[cfg(test)]
mod prop_tests {
    use super::*;
    use crate::model::{ComponentDefinition, DefinitionKind, JsxUsage};
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
                    declared_prop_options: BTreeMap::new(),
                    declared_prop_defaults: BTreeMap::new(),
                    cva_binding_name: None,
                })
                .collect(),
            usages: usages
                .into_iter()
                .map(|(comp, props)| JsxUsage {
                    component: comp.to_string(),
                    line: 5,
                    props: props.into_iter().map(|s| s.to_string()).collect(),
                    prop_values: BTreeMap::new(),
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
    fn rollup_counts_children_from_jsx_content() {
        let files = vec![make_file(
            "page.tsx",
            vec![],
            vec![("FlexStack", vec!["children"])],
        )];
        let rows = rollup_usage(&files);
        let flex = rows.iter().find(|r| r.component == "FlexStack").unwrap();
        assert_eq!(*flex.prop_frequencies.get("children").unwrap(), 1);
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
    fn rollup_ignores_playground_files() {
        let files = vec![
            make_file(
                "components/alert.playground.tsx",
                vec![],
                vec![("Alert", vec!["children", "variant"])],
            ),
            make_file("pages/settings.tsx", vec![], vec![("Alert", vec!["title"])]),
        ];

        let rows = rollup_usage(&files);
        let alert = rows.iter().find(|r| r.component == "Alert").unwrap();
        assert_eq!(alert.reference_count, 1);
        assert_eq!(alert.files, vec![PathBuf::from("pages/settings.tsx")]);
        assert_eq!(*alert.prop_frequencies.get("title").unwrap(), 1);
        assert!(!alert.prop_frequencies.contains_key("variant"));
        assert!(!alert.prop_frequencies.contains_key("children"));
    }

    #[test]
    fn unused_props_finds_never_passed_prop() {
        let files = vec![
            make_file(
                "Btn.tsx",
                vec![("Button", vec!["variant", "disabled", "onClick"])],
                vec![],
            ),
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
        assert!(
            findings
                .iter()
                .any(|f| f.rule_id == "unused-prop" && f.message.contains("disabled")),
            "{findings:?}"
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
        let files = vec![make_file("Btn.tsx", vec![("Button", vec!["unused"])], vec![])];
        let config = DslintConfig::default();
        let usage_map = rollup_usage(&files);
        let findings = unused_props_findings(&files, &usage_map, &config);
        assert!(findings.is_empty());
    }

    #[test]
    fn unused_props_skips_children_and_classname() {
        let files = vec![make_file(
            "Wrap.tsx",
            vec![("Wrapper", vec!["children", "className", "style", "extra"])],
            vec![],
        )];
        let config = DslintConfig {
            check_unused_props: true,
            ..Default::default()
        };
        let usage_map = rollup_usage(&files);
        let findings = unused_props_findings(&files, &usage_map, &config);
        assert_eq!(findings.len(), 1, "{findings:?}");
        assert!(findings[0].message.contains("extra"));
    }
}
