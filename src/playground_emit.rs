//! Build dashboard playground rows from scanned components + config (Rust AST only).
//!
//! `declared_prop_kinds` and `declared_prop_options` may be enriched post-scan by the
//! Node CLI TypeScript checker (`enrich-playgrounds-from-ts.mjs`) when `tsconfig.json`
//! is available. Rust still emits empty kinds and only CVA-derived options.

use std::collections::{BTreeMap, HashMap};
use std::path::Path;

use crate::config::DslintConfig;
use crate::example_tree::{descendant_component_stats, tree_node_count};
use crate::model::{ComponentDefinition, DefinitionKind, ExampleNode, FileScan, PlaygroundSpec};
use crate::util::kebab::kebab_to_pascal;
use crate::util::paths::{longest_matching_group, rel_path_under_root};

/// Longest matching prefix wins (nested groups).
fn longest_playground_group(rel: &str, config: &DslintConfig) -> Option<String> {
    longest_matching_group(rel, &config.playground_groups)
}

/// When `playground_groups` is empty, every scanned TSX/JSX under the repo root is previewable.
fn file_in_playground_scope(rel: &str, config: &DslintConfig) -> bool {
    if config.playground_groups.is_empty() {
        return !rel.is_empty();
    }
    longest_playground_group(rel, config).is_some()
}

/// Sidebar / breadcrumb group. Omitted when `playground_groups` has only one key so the UI stays flat.
fn playground_spec_group(rel: &str, config: &DslintConfig) -> Option<String> {
    if config.playground_groups.len() <= 1 {
        return None;
    }
    longest_playground_group(rel, config)
}

fn playable_definition(kind: DefinitionKind) -> bool {
    matches!(
        kind,
        DefinitionKind::Function
            | DefinitionKind::Class
            | DefinitionKind::ConstArrow
            | DefinitionKind::ConstFunction
            | DefinitionKind::WrappedComponent
    )
}

fn pick_definition<'a>(
    definitions: &'a [ComponentDefinition],
    stem: &str,
) -> Option<&'a ComponentDefinition> {
    let playable: Vec<_> = definitions
        .iter()
        .filter(|d| playable_definition(d.kind))
        .collect();
    if playable.is_empty() {
        return None;
    }
    if let Some(d) = playable.iter().find(|d| d.name == stem) {
        return Some(d);
    }
    let pascal = kebab_to_pascal(stem);
    if !pascal.is_empty() {
        if let Some(d) = playable.iter().find(|d| d.name == pascal) {
            return Some(d);
        }
    }
    let normalized_stem = normalized_name(stem);
    if !normalized_stem.is_empty() {
        let mut normalized_matches = playable
            .iter()
            .filter(|d| normalized_name(&d.name) == normalized_stem);
        let first = normalized_matches.next();
        if first.is_some() && normalized_matches.next().is_none() {
            return first.copied();
        }
    }
    if playable.len() == 1 {
        return Some(playable[0]);
    }
    None
}

fn normalized_name(value: &str) -> String {
    value
        .chars()
        .filter(|c| *c != '-' && *c != '_')
        .flat_map(char::to_lowercase)
        .collect()
}

/// Example files (`dropdown-menu.playground.tsx`) are not component sources.
fn is_playground_example_file(stem: &str) -> bool {
    stem.ends_with(".playground")
}

/// `(distinct_names, component_count, total_nodes)` — higher is a richer example.
fn example_tree_score(tree: &ExampleNode) -> (usize, usize, usize) {
    let (count, distinct) = descendant_component_stats(tree);
    (distinct, count, tree_node_count(tree))
}

/// Best captured composition per component name, across every scanned file.
///
/// Only compositions count: the call site must nest at least one further
/// design component (a `<Button>Save</Button>` usage stays on the plain
/// auto-render path).
fn best_example_trees(files: &[FileScan]) -> HashMap<&str, &ExampleNode> {
    let mut best: HashMap<&str, (&ExampleNode, (usize, usize, usize))> = HashMap::new();
    for file in files {
        for usage in &file.usages {
            let Some(tree) = &usage.example_tree else {
                continue;
            };
            let score = example_tree_score(tree);
            if score.1 == 0 {
                continue; // no nested design components — not a composition
            }
            match best.get(usage.component.as_str()) {
                Some((_, existing)) if *existing >= score => {}
                _ => {
                    best.insert(usage.component.as_str(), (tree, score));
                }
            }
        }
    }
    best.into_iter().map(|(k, (tree, _))| (k, tree)).collect()
}

/// One playground row per eligible TSX/JSX file in the scan (whole repo when `playground_groups` is unset).
pub fn build_playground_specs(
    root: &Path,
    files: &[FileScan],
    config: &DslintConfig,
) -> Vec<PlaygroundSpec> {
    let mut out = Vec::new();
    let example_trees = best_example_trees(files);
    for file in files {
        let path = &file.path;
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !matches!(ext.as_str(), "tsx" | "jsx") {
            continue;
        }
        let rel = rel_path_under_root(root, path);
        if rel.is_empty() || !file_in_playground_scope(&rel, config) {
            continue;
        }
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        if is_playground_example_file(&stem) {
            continue;
        }
        let Some(def) = pick_definition(&file.definitions, &stem) else {
            continue;
        };
        let group = playground_spec_group(&rel, config);
        let example_tree = example_trees.get(def.name.as_str()).map(|t| (*t).clone());
        out.push(PlaygroundSpec {
            id: def.name.clone(),
            export_name: def.name.clone(),
            rel_path: rel,
            declared_props: def.declared_props.clone(),
            declared_prop_kinds: BTreeMap::new(),
            declared_prop_options: def.declared_prop_options.clone(),
            declared_prop_defaults: def.declared_prop_defaults.clone(),
            group,
            example_tree,
        });
    }
    out.sort_by(|a, b| a.rel_path.cmp(&b.rel_path));
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{ComponentDefinition, DefinitionKind};
    use std::collections::HashMap;
    use std::path::PathBuf;

    fn cfg_single_components() -> DslintConfig {
        let mut playground_groups = HashMap::new();
        playground_groups.insert("components".into(), vec!["src/components".into()]);
        DslintConfig {
            playground_groups,
            ..Default::default()
        }
    }

    #[test]
    fn picks_stem_named_export() {
        let defs = vec![ComponentDefinition {
            name: "PrimaryButton".into(),
            kind: DefinitionKind::Function,
            line: 1,
            declared_props: vec!["children".into()],
            declared_prop_options: BTreeMap::new(),
            declared_prop_defaults: BTreeMap::new(),
            cva_binding_name: None,
            implementation_class_frequencies: BTreeMap::new(),
            implementation_class_locations: Vec::new(),
        }];
        let picked = pick_definition(&defs, "PrimaryButton").unwrap();
        assert_eq!(picked.name, "PrimaryButton");
    }

    #[test]
    fn picks_sole_export_when_name_differs_from_stem() {
        let defs = vec![ComponentDefinition {
            name: "Card".into(),
            kind: DefinitionKind::Function,
            line: 1,
            declared_props: vec![],
            declared_prop_options: BTreeMap::new(),
            declared_prop_defaults: BTreeMap::new(),
            cva_binding_name: None,
            implementation_class_frequencies: BTreeMap::new(),
            implementation_class_locations: Vec::new(),
        }];
        let picked = pick_definition(&defs, "DuplicateCardA").unwrap();
        assert_eq!(picked.name, "Card");
    }

    #[test]
    fn picks_kebab_stem_as_pascal_export() {
        let defs = vec![
            ComponentDefinition {
                name: "DropdownMenu".into(),
                kind: DefinitionKind::Function,
                line: 1,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            },
            ComponentDefinition {
                name: "DropdownMenuContent".into(),
                kind: DefinitionKind::Function,
                line: 2,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            },
        ];
        let picked = pick_definition(&defs, "dropdown-menu").unwrap();
        assert_eq!(picked.name, "DropdownMenu");
    }

    #[test]
    fn picks_kebab_stem_with_acronym_export() {
        let defs = vec![
            ComponentDefinition {
                name: "InputOTP".into(),
                kind: DefinitionKind::Function,
                line: 1,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            },
            ComponentDefinition {
                name: "InputOTPGroup".into(),
                kind: DefinitionKind::Function,
                line: 2,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            },
        ];
        let picked = pick_definition(&defs, "input-otp").unwrap();
        assert_eq!(picked.name, "InputOTP");
    }

    #[test]
    fn skips_ambiguous_multi_export() {
        let defs = vec![
            ComponentDefinition {
                name: "A".into(),
                kind: DefinitionKind::Function,
                line: 1,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            },
            ComponentDefinition {
                name: "B".into(),
                kind: DefinitionKind::Function,
                line: 2,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            },
        ];
        assert!(pick_definition(&defs, "OtherStem").is_none());
    }

    #[test]
    fn longest_prefix_wins_for_nested_groups() {
        let mut playground_groups = HashMap::new();
        playground_groups.insert("outer".into(), vec!["src/components".into()]);
        playground_groups.insert("inner".into(), vec!["src/components/nested".into()]);
        let config = DslintConfig {
            playground_groups,
            ..Default::default()
        };
        let g = longest_playground_group("src/components/nested/Foo.tsx", &config).unwrap();
        assert_eq!(g, "inner");
    }

    #[test]
    fn single_playground_group_omits_row_group() {
        let config = cfg_single_components();
        assert!(playground_spec_group("src/components/Foo.tsx", &config).is_none());
    }

    #[test]
    fn build_includes_all_tsx_when_playground_groups_unset() {
        let root = PathBuf::from("/repo");
        let config = DslintConfig::default();
        let files = vec![FileScan {
            path: PathBuf::from("/repo/src/views/ActionItem.tsx"),
            definitions: vec![ComponentDefinition {
                name: "ActionItem".into(),
                kind: DefinitionKind::Function,
                line: 1,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            }],
            usages: vec![],
            parse_errors: vec![],
            findings: vec![],
            ast_extracts: Default::default(),
        }];
        let specs = build_playground_specs(&root, &files, &config);
        assert_eq!(specs.len(), 1);
        assert_eq!(specs[0].export_name, "ActionItem");
        assert_eq!(specs[0].rel_path, "src/views/ActionItem.tsx");
    }

    #[test]
    fn build_skips_playground_example_files() {
        let root = PathBuf::from("/repo");
        let config = cfg_single_components();
        let files = vec![FileScan {
            path: PathBuf::from("/repo/src/components/ui/dropdown-menu.playground.tsx"),
            definitions: vec![ComponentDefinition {
                name: "dropdownMenuPlayground".into(),
                kind: DefinitionKind::ConstArrow,
                line: 1,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            }],
            usages: vec![],
            parse_errors: vec![],
            findings: vec![],
            ast_extracts: Default::default(),
        }];
        let specs = build_playground_specs(&root, &files, &config);
        assert!(specs.is_empty());
    }

    #[test]
    fn build_attaches_best_example_tree_from_usage() {
        use crate::model::JsxUsage;

        fn element(name: &str, children: Vec<ExampleNode>) -> ExampleNode {
            ExampleNode::Element {
                name: name.into(),
                props: BTreeMap::new(),
                children,
            }
        }

        let root = PathBuf::from("/repo");
        let config = DslintConfig::default();

        let breadcrumb_def = |name: &str, line: u32| ComponentDefinition {
            name: name.into(),
            kind: DefinitionKind::Function,
            line,
            declared_props: vec![],
            declared_prop_options: BTreeMap::new(),
            declared_prop_defaults: BTreeMap::new(),
            cva_binding_name: None,
            implementation_class_frequencies: BTreeMap::new(),
            implementation_class_locations: Vec::new(),
        };

        let small_tree = element("Breadcrumb", vec![element("BreadcrumbList", vec![])]);
        let rich_tree = element(
            "Breadcrumb",
            vec![element(
                "BreadcrumbList",
                vec![
                    element("BreadcrumbItem", vec![]),
                    element("BreadcrumbSeparator", vec![]),
                ],
            )],
        );
        // Composes nothing beyond intrinsics — must not qualify.
        let intrinsic_tree = element("Chip", vec![element("span", vec![])]);

        let files = vec![
            FileScan {
                path: PathBuf::from("/repo/src/ui/breadcrumb.tsx"),
                definitions: vec![
                    breadcrumb_def("Breadcrumb", 1),
                    breadcrumb_def("BreadcrumbList", 2),
                ],
                usages: vec![],
                parse_errors: vec![],
                findings: vec![],
                ast_extracts: Default::default(),
            },
            FileScan {
                path: PathBuf::from("/repo/src/ui/chip.tsx"),
                definitions: vec![breadcrumb_def("Chip", 1)],
                usages: vec![],
                parse_errors: vec![],
                findings: vec![],
                ast_extracts: Default::default(),
            },
            FileScan {
                path: PathBuf::from("/repo/src/pages/a.tsx"),
                definitions: vec![breadcrumb_def("PageA", 1)],
                usages: vec![
                    JsxUsage {
                        component: "Breadcrumb".into(),
                        line: 3,
                        props: vec![],
                        prop_values: BTreeMap::new(),
                        example_tree: Some(small_tree),
                    },
                    JsxUsage {
                        component: "Breadcrumb".into(),
                        line: 9,
                        props: vec![],
                        prop_values: BTreeMap::new(),
                        example_tree: Some(rich_tree.clone()),
                    },
                    JsxUsage {
                        component: "Chip".into(),
                        line: 20,
                        props: vec![],
                        prop_values: BTreeMap::new(),
                        example_tree: Some(intrinsic_tree),
                    },
                ],
                parse_errors: vec![],
                findings: vec![],
                ast_extracts: Default::default(),
            },
        ];

        let specs = build_playground_specs(&root, &files, &config);
        let breadcrumb = specs
            .iter()
            .find(|s| s.export_name == "Breadcrumb")
            .expect("Breadcrumb spec");
        assert_eq!(
            breadcrumb.example_tree.as_ref(),
            Some(&rich_tree),
            "richest composition wins"
        );

        let chip = specs.iter().find(|s| s.export_name == "Chip").expect("Chip spec");
        assert!(
            chip.example_tree.is_none(),
            "intrinsic-only trees are not compositions"
        );
    }

    #[test]
    fn build_skips_non_tsx() {
        let root = PathBuf::from("/repo");
        let config = cfg_single_components();
        let files = vec![FileScan {
            path: PathBuf::from("/repo/src/components/Readme.vue"),
            definitions: vec![ComponentDefinition {
                name: "X".into(),
                kind: DefinitionKind::Function,
                line: 1,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            }],
            usages: vec![],
            parse_errors: vec![],
            findings: vec![],
            ast_extracts: Default::default(),
        }];
        let specs = build_playground_specs(&root, &files, &config);
        assert!(specs.is_empty());
    }
}
