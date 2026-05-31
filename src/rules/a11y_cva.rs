//! Per-variant composed CVA class analysis for dark-mode contrast (CI).

use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::PathBuf;

use oxc_allocator::Allocator;
use oxc_parser::Parser;
use oxc_span::SourceType;

use crate::config::DslintConfig;
use crate::cva_extract::{self, CvaBinding};
use crate::model::{FileScan, LintFinding, Severity};
use crate::rules::dark_mode::{dark_mode_contrast_message, has_dark_mode_contrast_issue};

/// Matches dashboard `PLAYGROUND_VARIANT_MATRIX_CAP`.
pub const VARIANT_MATRIX_CAP: usize = 200;

pub fn cva_class_fragments(binding: &CvaBinding) -> HashSet<String> {
    let mut out = HashSet::new();
    if !binding.base_classes.is_empty() {
        out.insert(binding.base_classes.clone());
    }
    for axis in binding.variant_classes.values() {
        for classes in axis.values() {
            out.insert(classes.clone());
        }
    }
    out
}

pub fn format_variant_label(combo: &BTreeMap<String, String>, axis_keys: &[String]) -> String {
    axis_keys
        .iter()
        .map(|key| {
            let value = combo.get(key).map(String::as_str).unwrap_or("?");
            format!("{key}={value}")
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn merge_cva_classes(binding: &CvaBinding, combo: &BTreeMap<String, String>) -> String {
    let mut parts = Vec::new();
    if !binding.base_classes.is_empty() {
        parts.push(binding.base_classes.as_str());
    }
    for (axis, option) in combo {
        if let Some(classes) = binding
            .variant_classes
            .get(axis)
            .and_then(|m| m.get(option))
        {
            parts.push(classes.as_str());
        }
    }
    parts.join(" ")
}

fn enumerate_combinations(options: &BTreeMap<String, Vec<String>>) -> Vec<BTreeMap<String, String>> {
    let axis_keys: Vec<String> = options.keys().cloned().collect();
    if axis_keys.is_empty() {
        return Vec::new();
    }

    let mut total = 1usize;
    for key in &axis_keys {
        let len = options.get(key).map(|v| v.len()).unwrap_or(0);
        if len == 0 {
            return Vec::new();
        }
        total = total.saturating_mul(len);
    }

    let mut combinations = Vec::new();
    walk_combo(
        0,
        BTreeMap::new(),
        &mut combinations,
        &axis_keys,
        options,
    );
    let _ = total;
    combinations
}

fn walk_combo(
    i: usize,
    mut acc: BTreeMap<String, String>,
    combinations: &mut Vec<BTreeMap<String, String>>,
    axis_keys: &[String],
    options: &BTreeMap<String, Vec<String>>,
) {
    if combinations.len() >= VARIANT_MATRIX_CAP {
        return;
    }
    if i >= axis_keys.len() {
        combinations.push(acc);
        return;
    }
    let axis = &axis_keys[i];
    let Some(values) = options.get(axis) else {
        return;
    };
    for v in values {
        acc.insert(axis.clone(), v.clone());
        walk_combo(i + 1, acc.clone(), combinations, axis_keys, options);
    }
}

fn collect_cva_bindings_for_source(src: &str) -> HashMap<String, CvaBinding> {
    let allocator = Allocator::default();
    let program = Parser::new(&allocator, src, SourceType::tsx()).parse().program;
    cva_extract::collect_cva_bindings(&program)
}

pub fn cva_skip_fragments_for_files(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
) -> HashSet<String> {
    let mut skip = HashSet::new();
    for file in files {
        let Some(src) = sources.get(&file.path) else {
            continue;
        };
        let bindings = collect_cva_bindings_for_source(src);
        for binding in bindings.values() {
            skip.extend(cva_class_fragments(binding));
        }
    }
    skip
}

pub fn cva_composed_dark_mode_findings(
    files: &[FileScan],
    sources: &HashMap<PathBuf, String>,
    config: &DslintConfig,
) -> Vec<LintFinding> {
    if !config.check_dark_mode_contrast {
        return Vec::new();
    }

    let mut out = Vec::new();
    for file in files {
        let Some(src) = sources.get(&file.path) else {
            continue;
        };
        let bindings = collect_cva_bindings_for_source(src);

        for def in &file.definitions {
            if def.declared_prop_options.is_empty() {
                continue;
            }
            let Some(binding_name) = def.cva_binding_name.as_ref() else {
                continue;
            };
            let Some(binding) = bindings.get(binding_name) else {
                continue;
            };
            if binding.variant_classes.is_empty() {
                continue;
            }

            let axis_keys: Vec<String> = def.declared_prop_options.keys().cloned().collect();
            let combinations = enumerate_combinations(&def.declared_prop_options);

            for combo in combinations {
                let merged = merge_cva_classes(binding, &combo);
                if !has_dark_mode_contrast_issue(&merged) {
                    continue;
                }
                let label = format_variant_label(&combo, &axis_keys);
                out.push(
                    LintFinding::new(
                        "a11y-dark-mode-contrast",
                        file.path.clone(),
                        Some(def.line),
                        Severity::Info,
                        dark_mode_contrast_message(),
                    )
                    .with_variant_label(label),
                );
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    use crate::ecma::analyze_ecma_file;

    #[test]
    fn format_variant_label_joins_axes() {
        let mut combo = BTreeMap::new();
        combo.insert("variant".to_string(), "destructive".to_string());
        combo.insert("size".to_string(), "default".to_string());
        assert_eq!(
            format_variant_label(&combo, &["variant".to_string(), "size".to_string()]),
            "variant=destructive size=default"
        );
    }

    #[test]
    fn composed_contrast_flags_only_failing_variant_combo() {
        let src = r#"
const chipVariants = cva("inline-flex", {
  variants: {
    variant: {
      ok: "text-slate-900 dark:text-slate-100",
      bad: "bg-slate-100 text-slate-900",
    },
  },
  defaultVariants: { variant: "ok" },
});
function Chip({ variant }: VariantProps<typeof chipVariants>) {
  return null;
}
"#;
        let path = PathBuf::from("chip.tsx");
        let scan = analyze_ecma_file(&path, src);
        let mut sources = HashMap::new();
        sources.insert(path.clone(), src.to_string());
        let config = crate::config::DslintConfig {
            check_dark_mode_contrast: true,
            ..Default::default()
        };

        let findings = cva_composed_dark_mode_findings(&[scan], &sources, &config);
        let bad: Vec<_> = findings
            .iter()
            .filter(|f| f.variant_label.as_deref() == Some("variant=bad"))
            .collect();
        let ok: Vec<_> = findings
            .iter()
            .filter(|f| f.variant_label.as_deref() == Some("variant=ok"))
            .collect();
        assert_eq!(bad.len(), 1, "{findings:?}");
        assert!(ok.is_empty(), "{findings:?}");
    }

    #[test]
    fn variant_matrix_respects_cap() {
        let mut options = BTreeMap::new();
        for axis in ["a", "b", "c"] {
            options.insert(
                axis.to_string(),
                (0..10).map(|i| i.to_string()).collect(),
            );
        }
        let combos = enumerate_combinations(&options);
        assert!(combos.len() <= VARIANT_MATRIX_CAP);
    }

    #[test]
    fn cva_fragments_skip_isolated_dark_mode_scan() {
        let src = r#"
const chipVariants = cva("inline-flex", {
  variants: {
    variant: {
      bad: "bg-slate-100 text-slate-900",
      ok: "text-slate-900",
    },
  },
  defaultVariants: { variant: "ok" },
});
function Chip() { return null; }
"#;
        let path = PathBuf::from("chip.tsx");
        let scan = analyze_ecma_file(&path, src);
        let mut sources = HashMap::new();
        sources.insert(path.clone(), src.to_string());
        let skip = cva_skip_fragments_for_files(&[scan.clone()], &sources);
        assert!(skip.contains("bg-slate-100 text-slate-900"));

        let config = crate::config::DslintConfig {
            check_dark_mode_contrast: true,
            ..Default::default()
        };
        let isolated =
            crate::rules::dark_mode::dark_mode_contrast_findings(&[scan], &sources, &config, &skip);
        assert!(
            !isolated
                .iter()
                .any(|f| f.message.contains("bg-slate-100") || f.variant_label.is_some()),
            "{isolated:?}"
        );
    }
}
