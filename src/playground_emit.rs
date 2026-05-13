//! Build workbench playground rows from scanned components + config (no TS boilerplate).

use std::collections::BTreeMap;
use std::path::Path;

use crate::config::DslintConfig;
use crate::model::{ComponentDefinition, DefinitionKind, FileScan, PlaygroundSpec};

fn rel_path_under_root(root: &Path, file_path: &Path) -> String {
    let root_canon = std::fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    file_path
        .strip_prefix(&root_canon)
        .ok()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_default()
}

/// Longest matching prefix wins (nested groups).
fn longest_playground_group(rel: &str, config: &DslintConfig) -> Option<String> {
    if config.playground_groups.is_empty() {
        return None;
    }
    let rel = rel.trim_start_matches('/');
    let mut best: Option<(usize, String)> = None;
    for (group, prefixes) in &config.playground_groups {
        for pre_raw in prefixes {
            let pre = pre_raw.trim().trim_start_matches('/').trim_end_matches('/');
            if pre.is_empty() {
                continue;
            }
            if rel == pre || rel.starts_with(&format!("{pre}/")) {
                let len = pre.len();
                if best.as_ref().map_or(true, |(l, _)| len > *l) {
                    best = Some((len, group.clone()));
                }
            }
        }
    }
    best.map(|(_, g)| g)
}

fn file_in_playground_prefix(rel: &str, config: &DslintConfig) -> bool {
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
    if playable.len() == 1 {
        return Some(playable[0]);
    }
    None
}

/// One playground row per eligible TSX/JSX file under `playground_groups` prefixes.
pub fn build_playground_specs(root: &Path, files: &[FileScan], config: &DslintConfig) -> Vec<PlaygroundSpec> {
    let mut out = Vec::new();
    if config.playground_groups.is_empty() {
        return out;
    }
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
        if rel.is_empty() || !file_in_playground_prefix(&rel, config) {
            continue;
        }
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        let Some(def) = pick_definition(&file.definitions, &stem) else {
            continue;
        };
        let group = playground_spec_group(&rel, config);
        out.push(PlaygroundSpec {
            id: stem,
            export_name: def.name.clone(),
            rel_path: rel,
            declared_props: def.declared_props.clone(),
            declared_prop_kinds: BTreeMap::new(),
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
        }];
        let picked = pick_definition(&defs, "DuplicateCardA").unwrap();
        assert_eq!(picked.name, "Card");
    }

    #[test]
    fn skips_ambiguous_multi_export() {
        let defs = vec![
            ComponentDefinition {
                name: "A".into(),
                kind: DefinitionKind::Function,
                line: 1,
                declared_props: vec![],
            },
            ComponentDefinition {
                name: "B".into(),
                kind: DefinitionKind::Function,
                line: 2,
                declared_props: vec![],
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
            }],
            usages: vec![],
            parse_errors: vec![],
            findings: vec![],
        }];
        let specs = build_playground_specs(&root, &files, &config);
        assert!(specs.is_empty());
    }
}
