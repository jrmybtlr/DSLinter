//! Roll up Tailwind/class tokens from component implementations (including intrinsics).

use crate::model::{ClassStringFragment, ComponentDefinition, FileScan, ImplementationClassLocation};

/// Split a class fragment into individual utility tokens (`dark:ml-1.5` stays whole).
pub fn split_class_tokens(fragment: &str) -> impl Iterator<Item = &str> {
    fragment.split_whitespace().filter(|t| !t.is_empty())
}

fn record_fragment(
    def: &mut ComponentDefinition,
    fragment: &ClassStringFragment,
) {
    def.implementation_class_locations
        .push(ImplementationClassLocation {
            line: fragment.line,
            classes: fragment.text.clone(),
        });
    for token in split_class_tokens(&fragment.text) {
        *def.implementation_class_frequencies
            .entry(token.to_string())
            .or_insert(0) += 1;
    }
}

/// Attach JSX / `cn()` class strings from [`FileScan::ast_extracts`] to owning exports.
pub fn attach_implementation_classes(files: &mut [FileScan]) {
    for file in files {
        if file.ast_extracts.class_strings.is_empty() || file.definitions.is_empty() {
            continue;
        }
        let fragments: Vec<ClassStringFragment> = file.ast_extracts.class_strings.clone();
        for fragment in fragments {
            let idx = file
                .definitions
                .iter()
                .enumerate()
                .filter(|(_, def)| def.line <= fragment.line)
                .max_by_key(|(_, def)| def.line)
                .map(|(i, _)| i);
            let Some(idx) = idx else {
                continue;
            };
            record_fragment(&mut file.definitions[idx], &fragment);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ecma::analyze_ecma_file;
    use crate::model::{ClassStringKind, DefinitionKind};
    use std::collections::BTreeMap;
    use std::path::PathBuf;

    #[test]
    fn attributes_intrinsic_span_classes_to_owning_export() {
        let src = r#"
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AppearanceToggleTab() {
  return (
    <div className={cn('inline-flex gap-1', className)}>
      {tabs.map(({ icon: Icon, label }) => (
        <button className={cn('flex items-center px-3.5 py-1.5')}>
          <Icon className="-ml-1 h-4 w-4" />
          <span className="ml-1.5 text-sm">{label}</span>
        </button>
      ))}
    </div>
  );
}
"#;
        let mut scan = analyze_ecma_file(&PathBuf::from("appearance-tabs.tsx"), src);
        attach_implementation_classes(std::slice::from_mut(&mut scan));

        let def = scan
            .definitions
            .iter()
            .find(|d| d.name.contains("AppearanceToggleTab"))
            .expect("component definition");

        assert!(
            def.implementation_class_frequencies.get("ml-1.5").copied()
                >= Some(1),
            "span ml-1.5 missing: {:?}",
            def.implementation_class_frequencies
        );
        assert!(
            def.implementation_class_frequencies.get("-ml-1").copied() >= Some(1),
            "Icon -ml-1 missing"
        );
        assert!(
            def.implementation_class_frequencies.get("py-1.5").copied() >= Some(1),
            "button py-1.5 missing"
        );
    }

    #[test]
    fn multi_export_file_assigns_by_line() {
        let mut file = FileScan::empty(PathBuf::from("kit.tsx"));
        file.definitions = vec![
            ComponentDefinition {
                name: "Root".into(),
                kind: DefinitionKind::Function,
                line: 1,
                declared_props: Vec::new(),
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            },
            ComponentDefinition {
                name: "Part".into(),
                kind: DefinitionKind::Function,
                line: 10,
                declared_props: Vec::new(),
                declared_prop_options: BTreeMap::new(),
                declared_prop_defaults: BTreeMap::new(),
                cva_binding_name: None,
                implementation_class_frequencies: BTreeMap::new(),
                implementation_class_locations: Vec::new(),
            },
        ];
        file.ast_extracts.class_strings = vec![
            ClassStringFragment {
                line: 5,
                text: "root-only".into(),
                kind: ClassStringKind::JsxAttr,
            },
            ClassStringFragment {
                line: 12,
                text: "part-only ml-2".into(),
                kind: ClassStringKind::JsxAttr,
            },
        ];

        attach_implementation_classes(std::slice::from_mut(&mut file));

        assert_eq!(
            file.definitions[0].implementation_class_frequencies.get("root-only"),
            Some(&1)
        );
        assert!(
            file.definitions[0]
                .implementation_class_frequencies
                .get("ml-2")
                .is_none()
        );
        assert_eq!(
            file.definitions[1].implementation_class_frequencies.get("ml-2"),
            Some(&1)
        );
    }
}
