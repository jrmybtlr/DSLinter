//! Build dashboard playground rows from scanned components + config (Rust AST only).
//!
//! `declared_prop_kinds` and `declared_prop_options` may be enriched post-scan by the
//! Node CLI TypeScript checker (`enrich-playgrounds-from-ts.mjs`) when `tsconfig.json`
//! is available. Rust still emits empty kinds and only CVA-derived options.

use std::collections::BTreeMap;
use std::path::Path;

use crate::config::DslintConfig;
use crate::model::{ComponentDefinition, DefinitionKind, FileScan, PlaygroundSpec};
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

/// One playground row per eligible TSX/JSX file in the scan (whole repo when `playground_groups` is unset).
pub fn build_playground_specs(
    root: &Path,
    files: &[FileScan],
    config: &DslintConfig,
) -> Vec<PlaygroundSpec> {
    let mut out = Vec::new();
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
        out.push(PlaygroundSpec {
            id: def.name.clone(),
            export_name: def.name.clone(),
            rel_path: rel,
            declared_props: def.declared_props.clone(),
            declared_prop_kinds: BTreeMap::new(),
            declared_prop_options: def.declared_prop_options.clone(),
            declared_prop_defaults: def.declared_prop_defaults.clone(),
            group,
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
            },
            ComponentDefinition {
                name: "DropdownMenuContent".into(),
                kind: DefinitionKind::Function,
                line: 2,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
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
            },
            ComponentDefinition {
                name: "InputOTPGroup".into(),
                kind: DefinitionKind::Function,
                line: 2,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
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
            },
            ComponentDefinition {
                name: "B".into(),
                kind: DefinitionKind::Function,
                line: 2,
                declared_props: vec![],
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
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
