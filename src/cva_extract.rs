//! Extract `class-variance-authority` `cva(...)` variant keys for playground select controls.

use std::collections::{BTreeMap, HashMap};

use oxc_ast::ast::{
    Argument, Declaration, Expression, FormalParameters, ObjectPropertyKind, Program, PropertyKey,
    Statement, TSType, TSTypeName, TSTypeQueryExprName, VariableDeclarator,
};

/// Parsed `cva` config: variant option keys per prop and `defaultVariants` values.
#[derive(Debug, Clone, Default)]
pub struct CvaBinding {
    pub variant_options: BTreeMap<String, Vec<String>>,
    pub default_variants: BTreeMap<String, String>,
}

/// Map `buttonVariants` → parsed CVA config from top-level `const x = cva(...)`.
pub fn collect_cva_bindings<'a>(program: &'a Program<'a>) -> HashMap<String, CvaBinding> {
    let mut out = HashMap::new();
    for stmt in &program.body {
        ingest_statement_for_cva(stmt, &mut out);
    }
    out
}

fn ingest_statement_for_cva<'a>(
    stmt: &'a Statement<'a>,
    out: &mut HashMap<String, CvaBinding>,
) {
    match stmt {
        Statement::VariableDeclaration(decl) => {
            for d in &decl.declarations {
                record_cva_declarator(d, out);
            }
        }
        Statement::ExportNamedDeclaration(ex) => {
            if let Some(Declaration::VariableDeclaration(decl)) = &ex.declaration {
                for d in &decl.declarations {
                    record_cva_declarator(d, out);
                }
            }
        }
        _ => {}
    }
}

fn record_cva_declarator<'a>(
    decl: &'a VariableDeclarator<'a>,
    out: &mut HashMap<String, CvaBinding>,
) {
    let oxc_ast::ast::BindingPatternKind::BindingIdentifier(id) = &decl.id.kind else {
        return;
    };
    let Some(init) = decl.init.as_ref() else {
        return;
    };
    let Some(parsed) = parse_cva_call(init) else {
        return;
    };
    out.insert(id.name.as_str().to_string(), parsed);
}

fn parse_cva_call(expr: &Expression<'_>) -> Option<CvaBinding> {
    let Expression::CallExpression(call) = expr else {
        return None;
    };
    let Expression::Identifier(ident) = &call.callee else {
        return None;
    };
    if ident.name.as_str() != "cva" {
        return None;
    }
    let config = call.arguments.get(1)?;
    let Argument::ObjectExpression(obj) = config else {
        return None;
    };
    let mut binding = CvaBinding::default();
    for prop in &obj.properties {
        let ObjectPropertyKind::ObjectProperty(p) = prop else {
            continue;
        };
        let key = static_property_key(&p.key)?;
        match key.as_str() {
            "variants" => {
                let Expression::ObjectExpression(variants_obj) = &p.value else {
                    continue;
                };
                for vprop in &variants_obj.properties {
                    let ObjectPropertyKind::ObjectProperty(vp) = vprop else {
                        continue;
                    };
                    let prop_name = static_property_key(&vp.key)?;
                    let Expression::ObjectExpression(options_obj) = &vp.value else {
                        continue;
                    };
                    let mut options = Vec::new();
                    for op in &options_obj.properties {
                        let ObjectPropertyKind::ObjectProperty(oprop) = op else {
                            continue;
                        };
                        if let Some(opt_key) = static_property_key(&oprop.key) {
                            options.push(opt_key);
                        }
                    }
                    if options.len() >= 2 {
                        binding.variant_options.insert(prop_name, options);
                    }
                }
            }
            "defaultVariants" => {
                let Expression::ObjectExpression(defaults_obj) = &p.value else {
                    continue;
                };
                for dprop in &defaults_obj.properties {
                    let ObjectPropertyKind::ObjectProperty(dp) = dprop else {
                        continue;
                    };
                    let prop_name = static_property_key(&dp.key)?;
                    if let Some(val) = string_literal_value(&dp.value) {
                        binding.default_variants.insert(prop_name, val);
                    }
                }
            }
            _ => {}
        }
    }
    if binding.variant_options.is_empty() {
        return None;
    }
    Some(binding)
}

fn static_property_key(key: &PropertyKey<'_>) -> Option<String> {
    match key {
        PropertyKey::StaticIdentifier(id) => Some(id.name.as_str().to_string()),
        PropertyKey::StringLiteral(s) => Some(s.value.to_string()),
        _ => None,
    }
}

fn string_literal_value(expr: &Expression<'_>) -> Option<String> {
    match expr {
        Expression::StringLiteral(s) => Some(s.value.to_string()),
        _ => None,
    }
}

/// Resolve CVA variant options for a component from `VariantProps<typeof binding>` in its param type.
pub fn prop_options_from_params(
    params: &FormalParameters<'_>,
    cva_bindings: &HashMap<String, CvaBinding>,
) -> (BTreeMap<String, Vec<String>>, BTreeMap<String, String>) {
    let Some(binding_name) = cva_binding_name_from_params(params) else {
        return (BTreeMap::new(), BTreeMap::new());
    };
    let Some(cva) = cva_bindings.get(&binding_name) else {
        return (BTreeMap::new(), BTreeMap::new());
    };
    (
        cva.variant_options.clone(),
        cva.default_variants.clone(),
    )
}

fn cva_binding_name_from_params(params: &FormalParameters<'_>) -> Option<String> {
    let first = params.items.first()?;
    let note = first.pattern.type_annotation.as_ref()?;
    cva_binding_from_type(&note.type_annotation)
}

fn cva_binding_from_type(ty: &TSType<'_>) -> Option<String> {
    let ty = ty.without_parenthesized();
    match ty {
        TSType::TSIntersectionType(inter) => {
            for t in &inter.types {
                if let Some(name) = variant_props_binding_from_type(t) {
                    return Some(name);
                }
            }
            None
        }
        _ => variant_props_binding_from_type(ty),
    }
}

fn variant_props_binding_from_type(ty: &TSType<'_>) -> Option<String> {
    let ty = ty.without_parenthesized();
    let TSType::TSTypeReference(r) = ty else {
        return None;
    };
    let Some(root) = type_reference_root_name(&r.type_name) else {
        return None;
    };
    if root != "VariantProps" {
        return None;
    }
    let params = r.type_parameters.as_ref()?;
    let first = params.params.first()?;
    typeof_binding_name(first)
}

fn type_reference_root_name<'a>(type_name: &'a TSTypeName<'a>) -> Option<&'a str> {
    match type_name {
        TSTypeName::IdentifierReference(id) => Some(id.name.as_str()),
        TSTypeName::QualifiedName(qn) => Some(qn.right.name.as_str()),
    }
}

fn typeof_binding_name(ty: &TSType<'_>) -> Option<String> {
    let ty = ty.without_parenthesized();
    let TSType::TSTypeQuery(q) = ty else {
        return None;
    };
    let TSTypeQueryExprName::IdentifierReference(ident) = &q.expr_name else {
        return None;
    };
    Some(ident.name.as_str().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    use crate::ecma::analyze_ecma_file;

    #[test]
    fn parses_cva_variants_and_defaults() {
        let src = r#"
const buttonVariants = cva("base", {
  variants: {
    variant: { default: "a", destructive: "b", outline: "c" },
    size: { default: "d", sm: "e", lg: "f" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export function Placeholder() { return null; }
"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        let map = collect_cva_bindings_from_source(src);
        let cva = map.get("buttonVariants").expect("binding");
        let variant_opts = cva.variant_options.get("variant").unwrap();
        assert_eq!(variant_opts, &["default", "destructive", "outline"]);
        let size_opts = cva.variant_options.get("size").unwrap();
        assert_eq!(size_opts, &["default", "sm", "lg"]);
        assert_eq!(cva.default_variants.get("variant").map(String::as_str), Some("default"));
        let btn = scan
            .definitions
            .iter()
            .find(|d| d.name == "Placeholder")
            .expect("component");
        assert!(btn.declared_prop_options.is_empty());
    }

    #[test]
    fn resolves_variant_props_on_button() {
        let src = r#"
const buttonVariants = cva("base", {
  variants: {
    variant: { default: "a", destructive: "b" },
    size: { default: "c", sm: "d" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
function Button({ variant, size }: VariantProps<typeof buttonVariants>) {
  return null;
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("button.tsx"), src);
        let btn = scan.definitions.iter().find(|d| d.name == "Button").expect("Button");
        assert!(btn.declared_prop_options.contains_key("variant"));
        assert!(btn.declared_prop_options.contains_key("size"));
        assert_eq!(
            btn.declared_prop_defaults.get("variant").map(String::as_str),
            Some("default")
        );
    }

    fn collect_cva_bindings_from_source(src: &str) -> HashMap<String, CvaBinding> {
        use oxc_allocator::Allocator;
        use oxc_parser::Parser;
        use oxc_span::SourceType;
        let allocator = Allocator::default();
        let program = Parser::new(&allocator, src, SourceType::tsx()).parse().program;
        collect_cva_bindings(&program)
    }
}
