//! Detect third-party import bindings so JSX usages like `<SheetPrimitive.Root>`
//! are not treated as local design-system components.

use std::collections::HashSet;

use globset::{GlobBuilder, GlobSet, GlobSetBuilder};
use oxc_ast::ast::{
    ImportDeclarationSpecifier, Program, Statement,
};
use oxc_parser::{Parser, ParserReturn};
use oxc_span::SourceType;

use crate::config::DslintConfig;

/// Resolved import rules for a scan (from config + sensible defaults).
#[derive(Debug, Clone)]
pub struct ImportFilter {
    local_prefixes: Vec<String>,
    external_patterns: GlobSet,
}

impl ImportFilter {
    pub fn from_config(config: &DslintConfig) -> Self {
        let local_prefixes = if config.local_import_prefixes.is_empty() {
            default_local_import_prefixes_internal()
        } else {
            config.local_import_prefixes.clone()
        };
        let pattern_lines = if config.external_import_patterns.is_empty() {
            default_external_import_patterns_internal()
        } else {
            config.external_import_patterns.clone()
        };

        let mut builder = GlobSetBuilder::new();
        for raw in &pattern_lines {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                continue;
            }
            let glob = GlobBuilder::new(trimmed)
                .build()
                .unwrap_or_else(|e| panic!("invalid external_import_patterns entry {raw:?}: {e}"));
            builder.add(glob);
        }
        let external_patterns = builder
            .build()
            .expect("external_import_patterns globset");

        Self {
            local_prefixes,
            external_patterns,
        }
    }

    /// True when the module specifier refers to a third-party / npm package.
    pub fn is_external_module(&self, spec: &str) -> bool {
        if is_local_module_specifier(spec, &self.local_prefixes) {
            return false;
        }
        // Non-local imports are npm packages; explicit patterns catch documented scopes
        // and remain useful when `local_import_prefixes` is widened.
        self.external_patterns.is_match(spec) || !spec.starts_with('.')
    }

    /// Local JSX binding names (`SheetPrimitive`, `CheckIcon`, …) from external imports.
    pub fn external_jsx_bindings_from_program<'a>(&self, program: &'a Program<'a>) -> HashSet<String> {
        let mut out = HashSet::new();
        for stmt in &program.body {
            let Statement::ImportDeclaration(import) = stmt else {
                continue;
            };
            let spec = import.source.value.as_str();
            if !self.is_external_module(spec) {
                continue;
            }
            let Some(specifiers) = &import.specifiers else {
                continue;
            };
            for s in specifiers {
                let local = match s {
                    ImportDeclarationSpecifier::ImportSpecifier(spec) => {
                        spec.local.name.as_str()
                    }
                    ImportDeclarationSpecifier::ImportDefaultSpecifier(spec) => {
                        spec.local.name.as_str()
                    }
                    ImportDeclarationSpecifier::ImportNamespaceSpecifier(spec) => {
                        spec.local.name.as_str()
                    }
                };
                out.insert(local.to_string());
            }
        }
        out
    }

    /// Parse `source` and collect external JSX binding names (for Vue `<script>` blocks).
    pub fn external_jsx_bindings_from_source(
        &self,
        source: &str,
        parse_as_path: &std::path::Path,
    ) -> HashSet<String> {
        let allocator = oxc_allocator::Allocator::default();
        let source_type = SourceType::from_path(parse_as_path).unwrap_or_else(|_| SourceType::tsx());
        let ParserReturn { program, panicked, .. } =
            Parser::new(&allocator, source, source_type).parse();
        if panicked {
            return HashSet::new();
        }
        self.external_jsx_bindings_from_program(&program)
    }
}

fn is_local_module_specifier(spec: &str, local_prefixes: &[String]) -> bool {
    if spec.starts_with("./") || spec.starts_with("../") {
        return true;
    }
    local_prefixes.iter().any(|prefix| spec.starts_with(prefix))
}

/// Root identifier for JSX names (`SheetPrimitive.Description` → `SheetPrimitive`).
pub fn jsx_binding_root(full_name: &str) -> &str {
    full_name.split('.').next().unwrap_or(full_name)
}

pub fn usage_root_is_external(full_name: &str, external_bindings: &HashSet<String>) -> bool {
    external_bindings.contains(jsx_binding_root(full_name))
}

pub fn default_local_import_prefixes() -> Vec<String> {
    vec!["@/".into(), "~/".into()]
}

pub fn default_external_import_patterns() -> Vec<String> {
    vec![
        "@radix-ui/*".into(),
        "@headlessui/*".into(),
        "lucide-react".into(),
        "react".into(),
        "react-dom".into(),
        "@tanstack/*".into(),
    ]
}

fn default_local_import_prefixes_internal() -> Vec<String> {
    default_local_import_prefixes()
}

fn default_external_import_patterns_internal() -> Vec<String> {
    default_external_import_patterns()
}

impl Default for ImportFilter {
    fn default() -> Self {
        Self::from_config(&DslintConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn radix_namespace_import_is_external_binding() {
        let src = r#"
import * as SheetPrimitive from "@radix-ui/react-dialog"
export function Sheet() {
  return <SheetPrimitive.Root />
}
"#;
        let filter = ImportFilter::default();
        let bindings = filter.external_jsx_bindings_from_source(src, &PathBuf::from("sheet.tsx"));
        assert!(bindings.contains("SheetPrimitive"));
    }

    #[test]
    fn alias_import_is_local_binding() {
        let src = r#"
import { Button } from "@/components/ui/button"
export function Page() {
  return <Button />
}
"#;
        let filter = ImportFilter::default();
        let bindings = filter.external_jsx_bindings_from_source(src, &PathBuf::from("page.tsx"));
        assert!(!bindings.contains("Button"));
    }

    #[test]
    fn local_relative_import_is_not_external() {
        let filter = ImportFilter::default();
        assert!(!filter.is_external_module("./DesignHeader"));
        assert!(!filter.is_external_module("../ui/button"));
        assert!(!filter.is_external_module("@/lib/utils"));
        assert!(filter.is_external_module("@radix-ui/react-dialog"));
        assert!(filter.is_external_module("lucide-react"));
    }

    #[test]
    fn jsx_binding_root_splits_member_expression() {
        assert_eq!(jsx_binding_root("SheetPrimitive.Description"), "SheetPrimitive");
        assert_eq!(jsx_binding_root("Button"), "Button");
    }
}
