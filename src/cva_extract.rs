//! Extract `class-variance-authority` `cva(...)` variant keys for playground select controls.

use std::collections::{BTreeMap, HashMap};

use oxc_ast::ast::{
    Argument, Declaration, Expression, FormalParameters, ObjectPropertyKind, Program, PropertyKey,
    Statement, TSType, TSTypeName, TSTypeQueryExprName, VariableDeclarator,
};

use crate::lines::line_of_offset;
use crate::model::{ClassStringFragment, ClassStringKind};

/// Parsed `cva` config: variant option keys per prop, class literals, and `defaultVariants`.
#[derive(Debug, Clone, Default)]
pub struct CvaBinding {
    /// First `cva("...")` base class string when a static literal.
    pub base_classes: String,
    /// Per-axis option → Tailwind class literal from `variants.{axis}.{option}`.
    pub variant_classes: BTreeMap<String, BTreeMap<String, String>>,
    pub variant_options: BTreeMap<String, Vec<String>>,
    pub default_variants: BTreeMap<String, String>,
}

/// Map `buttonVariants` → parsed CVA config from top-level `const x = cva(...)`.
pub fn collect_cva_bindings<'a>(program: &'a Program<'a>) -> HashMap<String, CvaBinding> {
    collect_cva(program, None).0
}

/// Class-string fragments from `cva(...)` base + variant option literals (for token/class rules).
pub fn collect_cva_class_fragments(
    newlines: &[usize],
    program: &Program<'_>,
) -> Vec<ClassStringFragment> {
    collect_cva(program, Some(newlines)).1
}

fn collect_cva(
    program: &Program<'_>,
    newlines: Option<&[usize]>,
) -> (HashMap<String, CvaBinding>, Vec<ClassStringFragment>) {
    let mut out = HashMap::new();
    let mut fragments = Vec::new();
    for stmt in &program.body {
        ingest_statement_for_cva(stmt, &mut out, newlines, &mut fragments);
    }
    (out, fragments)
}

fn ingest_statement_for_cva(
    stmt: &Statement<'_>,
    out: &mut HashMap<String, CvaBinding>,
    newlines: Option<&[usize]>,
    fragments: &mut Vec<ClassStringFragment>,
) {
    match stmt {
        Statement::VariableDeclaration(decl) => {
            for d in &decl.declarations {
                record_cva_declarator(d, out, newlines, fragments);
            }
        }
        Statement::ExportNamedDeclaration(ex) => {
            if let Some(Declaration::VariableDeclaration(decl)) = &ex.declaration {
                for d in &decl.declarations {
                    record_cva_declarator(d, out, newlines, fragments);
                }
            }
        }
        _ => {}
    }
}

fn record_cva_declarator(
    decl: &VariableDeclarator<'_>,
    out: &mut HashMap<String, CvaBinding>,
    newlines: Option<&[usize]>,
    fragments: &mut Vec<ClassStringFragment>,
) {
    let oxc_ast::ast::BindingPatternKind::BindingIdentifier(id) = &decl.id.kind else {
        return;
    };
    let Some(init) = decl.init.as_ref() else {
        return;
    };
    let Some(parsed) = parse_cva_call(init, newlines, fragments) else {
        return;
    };
    out.insert(id.name.as_str().to_string(), parsed);
}

fn push_cva_class_fragment(
    newlines: Option<&[usize]>,
    fragments: &mut Vec<ClassStringFragment>,
    span_start: u32,
    text: &str,
) {
    let Some(newlines) = newlines else {
        return;
    };
    if text.is_empty() {
        return;
    }
    fragments.push(ClassStringFragment {
        line: line_of_offset(newlines, span_start as usize),
        text: text.to_string(),
        kind: ClassStringKind::Cva,
    });
}

fn parse_cva_call(
    expr: &Expression<'_>,
    newlines: Option<&[usize]>,
    fragments: &mut Vec<ClassStringFragment>,
) -> Option<CvaBinding> {
    let Expression::CallExpression(call) = expr else {
        return None;
    };
    let Expression::Identifier(ident) = &call.callee else {
        return None;
    };
    if ident.name.as_str() != "cva" {
        return None;
    }
    let mut binding = CvaBinding::default();
    let mut pending_fragments: Vec<(u32, String)> = Vec::new();
    if let Some(Argument::StringLiteral(base)) = call.arguments.first() {
        binding.base_classes = base.value.to_string();
        pending_fragments.push((base.span.start, base.value.to_string()));
    }
    let config = call.arguments.get(1)?;
    let Argument::ObjectExpression(obj) = config else {
        return None;
    };
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
                    let mut classes_by_option = BTreeMap::new();
                    let mut axis_fragments: Vec<(u32, String)> = Vec::new();
                    for op in &options_obj.properties {
                        let ObjectPropertyKind::ObjectProperty(oprop) = op else {
                            continue;
                        };
                        if let Some(opt_key) = static_property_key(&oprop.key) {
                            options.push(opt_key.clone());
                            if let Some((classes, span_start)) =
                                string_literal_with_span(&oprop.value)
                            {
                                axis_fragments.push((span_start, classes.clone()));
                                classes_by_option.insert(opt_key, classes);
                            }
                        }
                    }
                    if options.len() >= 2 {
                        binding.variant_options.insert(prop_name.clone(), options);
                        if !classes_by_option.is_empty() {
                            binding.variant_classes.insert(prop_name, classes_by_option);
                        }
                        pending_fragments.extend(axis_fragments);
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
    for (span_start, text) in pending_fragments {
        push_cva_class_fragment(newlines, fragments, span_start, &text);
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
    string_literal_with_span(expr).map(|(s, _)| s)
}

fn string_literal_with_span(expr: &Expression<'_>) -> Option<(String, u32)> {
    match expr {
        Expression::StringLiteral(s) => Some((s.value.to_string(), s.span.start)),
        _ => None,
    }
}

/// Binding name from `VariantProps<typeof binding>` on the component's first parameter.
pub fn cva_binding_name_from_params(params: &FormalParameters<'_>) -> Option<String> {
    let first = params.items.first()?;
    let note = first.pattern.type_annotation.as_ref()?;
    cva_binding_from_type(&note.type_annotation)
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
        assert_eq!(cva.base_classes, "base");
        assert_eq!(
            cva.variant_classes
                .get("variant")
                .and_then(|m| m.get("destructive"))
                .map(String::as_str),
            Some("b")
        );
        assert_eq!(
            cva.variant_classes
                .get("size")
                .and_then(|m| m.get("sm"))
                .map(String::as_str),
            Some("e")
        );
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

    #[test]
    fn folds_cva_class_literals_into_ast_extracts() {
        use crate::model::ClassStringKind;

        let src = r#"
const buttonVariants = cva("inline-flex", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      destructive: "bg-destructive text-white shadow-xs",
    },
  },
  defaultVariants: { variant: "default" },
});
function Button({
  className,
  variant,
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, className }))} />;
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("button.tsx"), src);
        let cva_frags: Vec<_> = scan
            .ast_extracts
            .class_strings
            .iter()
            .filter(|c| c.kind == ClassStringKind::Cva)
            .collect();
        assert!(
            cva_frags.iter().any(|c| c.text.contains("text-white")),
            "expected destructive text-white in class_strings: {:?}",
            scan.ast_extracts.class_strings
        );
        assert!(
            cva_frags.iter().any(|c| c.text.contains("inline-flex")),
            "expected base classes: {:?}",
            cva_frags
        );
        let destructive = cva_frags
            .iter()
            .find(|c| c.text.contains("text-white"))
            .expect("destructive frag");
        assert!(
            destructive.line > 1,
            "expected line near variant literal, got {}",
            destructive.line
        );
    }

    #[test]
    fn inertia_button_cva_includes_text_white() {
        use crate::model::ClassStringKind;

        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("demo/inertia/resources/js/components/ui/button.tsx");
        let src = std::fs::read_to_string(&path).expect("read button.tsx");
        let scan = analyze_ecma_file(&path, &src);
        assert!(
            scan.ast_extracts
                .class_strings
                .iter()
                .any(|c| c.kind == ClassStringKind::Cva && c.text.contains("text-white")),
            "demo Button destructive CVA should contribute text-white: {:?}",
            scan.ast_extracts.class_strings
        );
        assert!(
            scan.ast_extracts
                .class_strings
                .iter()
                .any(|c| c.kind == ClassStringKind::Cva && c.text.contains("bg-destructive")),
            "demo Button destructive CVA should contribute bg-destructive"
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
