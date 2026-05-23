//! Best-effort extraction of component prop names from TypeScript types in the same file.
//!
//! Used to populate `declared_props` when the first parameter is not object-destructured
//! (e.g. `function X(props: XProps)`), by resolving `type` / `interface` declarations.

use std::collections::{HashMap, HashSet};

use oxc_ast::ast::{
    Declaration, ExportNamedDeclaration, FormalParameters, Program, PropertyKey, Statement,
    TSLiteral, TSInterfaceBody, TSSignature, TSType, TSTypeLiteral, TSTypeName, TSTypeReference,
};

/// Map type name → unique property keys from object literals / interfaces / aliases (declaration order).
pub fn collect_ts_prop_shape_map<'a>(program: &'a Program<'a>) -> HashMap<String, Vec<String>> {
    let mut alias_rhs: HashMap<String, &'a TSType<'a>> = HashMap::new();
    let mut interface_keys: HashMap<String, Vec<String>> = HashMap::new();

    for stmt in &program.body {
        ingest_top_level_statement(stmt, &mut alias_rhs, &mut interface_keys);
    }

    let mut memo: HashMap<String, Vec<String>> = HashMap::new();
    let mut stack = HashSet::new();

    let mut all_syms: Vec<String> = interface_keys
        .keys()
        .chain(alias_rhs.keys())
        .cloned()
        .collect();
    all_syms.sort();
    all_syms.dedup();

    for sym in all_syms {
        let _ = shape_for_symbol(
            &sym,
            &alias_rhs,
            &interface_keys,
            &mut memo,
            &mut stack,
        );
    }

    memo
}

/// Merge destructured prop names with keys from the first parameter's type annotation.
pub fn props_from_first_param_type_annotation(
    params: &FormalParameters<'_>,
    shapes: &HashMap<String, Vec<String>>,
) -> Vec<String> {
    let Some(first) = params.items.first() else {
        return Vec::new();
    };
    let Some(note) = first.pattern.type_annotation.as_ref() else {
        return Vec::new();
    };
    props_from_ts_type(&note.type_annotation, shapes, &mut HashSet::new())
}

/// True when the first parameter's type includes `React.ComponentProps<"intrinsic">` (or similar)
/// for an HTML element that accepts JSX children.
pub fn children_from_first_param_type_annotation(params: &FormalParameters<'_>) -> bool {
    let Some(first) = params.items.first() else {
        return false;
    };
    let Some(note) = first.pattern.type_annotation.as_ref() else {
        return false;
    };
    type_accepts_children(&note.type_annotation)
}

fn type_accepts_children(ty: &TSType<'_>) -> bool {
    let ty = ty.without_parenthesized();
    match ty {
        TSType::TSIntersectionType(i) => i
            .types
            .iter()
            .any(|t| type_accepts_children(t)),
        TSType::TSUnionType(u) => u.types.iter().any(|t| type_accepts_children(t)),
        TSType::TSTypeReference(r) => component_props_accepts_children(r),
        _ => false,
    }
}

fn component_props_accepts_children(r: &TSTypeReference<'_>) -> bool {
    let Some(sym) = type_reference_root_name(&r.type_name) else {
        return false;
    };
    if sym != "ComponentProps" && sym != "ComponentPropsWithoutRef" {
        return false;
    }
    let Some(params) = r.type_parameters.as_ref() else {
        return false;
    };
    let Some(first) = params.params.first() else {
        return false;
    };
    intrinsic_tag_accepts_children(first)
}

fn intrinsic_tag_accepts_children(ty: &TSType<'_>) -> bool {
    let ty = ty.without_parenthesized();
    let TSType::TSLiteralType(lit) = ty else {
        return false;
    };
    let TSLiteral::StringLiteral(s) = &lit.literal else {
        return false;
    };
    intrinsic_accepts_children(s.value.as_str())
}

fn intrinsic_accepts_children(tag: &str) -> bool {
    matches!(
        tag,
        "a" | "article"
            | "aside"
            | "button"
            | "code"
            | "details"
            | "div"
            | "em"
            | "fieldset"
            | "footer"
            | "form"
            | "h1"
            | "h2"
            | "h3"
            | "h4"
            | "h5"
            | "h6"
            | "header"
            | "label"
            | "legend"
            | "li"
            | "main"
            | "nav"
            | "ol"
            | "p"
            | "pre"
            | "section"
            | "small"
            | "span"
            | "strong"
            | "summary"
            | "table"
            | "tbody"
            | "td"
            | "tfoot"
            | "th"
            | "thead"
            | "tr"
            | "ul"
    )
}

fn ingest_top_level_statement<'a>(
    stmt: &'a Statement<'a>,
    alias_rhs: &mut HashMap<String, &'a TSType<'a>>,
    interface_keys: &mut HashMap<String, Vec<String>>,
) {
    match stmt {
        Statement::TSTypeAliasDeclaration(decl) => {
            let name = binding_name(&decl.id);
            alias_rhs.insert(name, &decl.type_annotation);
        }
        Statement::TSInterfaceDeclaration(decl) => {
            let name = binding_name(&decl.id);
            interface_keys.insert(name, keys_from_interface_body(&decl.body));
        }
        Statement::ExportNamedDeclaration(ex) => {
            ingest_export_named(ex, alias_rhs, interface_keys);
        }
        _ => {}
    }
}

fn ingest_export_named<'a>(
    ex: &'a ExportNamedDeclaration<'a>,
    alias_rhs: &mut HashMap<String, &'a TSType<'a>>,
    interface_keys: &mut HashMap<String, Vec<String>>,
) {
    let Some(decl) = &ex.declaration else {
        return;
    };
    match decl {
        Declaration::TSTypeAliasDeclaration(decl) => {
            let name = binding_name(&decl.id);
            alias_rhs.insert(name, &decl.type_annotation);
        }
        Declaration::TSInterfaceDeclaration(decl) => {
            let name = binding_name(&decl.id);
            interface_keys.insert(name, keys_from_interface_body(&decl.body));
        }
        _ => {}
    }
}

fn binding_name(id: &oxc_ast::ast::BindingIdentifier<'_>) -> String {
    id.name.as_str().to_string()
}

fn keys_from_interface_body(body: &TSInterfaceBody<'_>) -> Vec<String> {
    let mut keys = Vec::new();
    for m in &body.body {
        if let TSSignature::TSPropertySignature(prop) = m {
            if !prop.computed {
                if let PropertyKey::StaticIdentifier(id) = &prop.key {
                    keys.push(id.name.as_str().to_string());
                }
            }
        }
    }
    dedupe_preserve_order(&mut keys);
    keys
}

fn keys_from_type_literal(lit: &TSTypeLiteral<'_>) -> Vec<String> {
    let mut keys = Vec::new();
    for m in &lit.members {
        if let TSSignature::TSPropertySignature(prop) = m {
            if !prop.computed {
                if let PropertyKey::StaticIdentifier(id) = &prop.key {
                    keys.push(id.name.as_str().to_string());
                }
            }
        }
    }
    dedupe_preserve_order(&mut keys);
    keys
}

fn dedupe_preserve_order(keys: &mut Vec<String>) {
    let mut seen = HashSet::new();
    keys.retain(|k| seen.insert(k.clone()));
}

fn merge_prop_vecs(vecs: impl Iterator<Item = Vec<String>>) -> Vec<String> {
    let mut acc: Vec<String> = Vec::new();
    let mut seen = HashSet::new();
    for v in vecs {
        for k in v {
            if seen.insert(k.clone()) {
                acc.push(k);
            }
        }
    }
    acc
}

fn type_reference_root_name<'a>(type_name: &'a TSTypeName<'a>) -> Option<&'a str> {
    match type_name {
        TSTypeName::IdentifierReference(id) => Some(id.name.as_str()),
        TSTypeName::QualifiedName(qn) => Some(qn.right.name.as_str()),
    }
}

fn shape_for_symbol<'a>(
    sym: &str,
    alias_rhs: &HashMap<String, &'a TSType<'a>>,
    interface_keys: &HashMap<String, Vec<String>>,
    memo: &mut HashMap<String, Vec<String>>,
    stack: &mut HashSet<String>,
) -> Vec<String> {
    if let Some(done) = memo.get(sym) {
        return done.clone();
    }
    if stack.contains(sym) {
        return Vec::new();
    }
    stack.insert(sym.to_string());

    let keys = if let Some(rhs) = alias_rhs.get(sym).copied() {
        expand_type_to_prop_keys(rhs, alias_rhs, interface_keys, memo, stack)
    } else {
        interface_keys.get(sym).cloned().unwrap_or_default()
    };

    stack.remove(sym);
    memo.insert(sym.to_string(), keys.clone());
    keys
}

fn expand_type_to_prop_keys<'a>(
    ty: &'a TSType<'a>,
    alias_rhs: &HashMap<String, &'a TSType<'a>>,
    interface_keys: &HashMap<String, Vec<String>>,
    memo: &mut HashMap<String, Vec<String>>,
    stack: &mut HashSet<String>,
) -> Vec<String> {
    let ty = ty.without_parenthesized();
    match ty {
        TSType::TSTypeLiteral(lit) => keys_from_type_literal(lit),
        TSType::TSTypeReference(r) => {
            let Some(sym) = type_reference_root_name(&r.type_name) else {
                return Vec::new();
            };
            shape_for_symbol(sym, alias_rhs, interface_keys, memo, stack)
        }
        TSType::TSUnionType(u) => merge_prop_vecs(
            u.types
                .iter()
                .map(|t| expand_type_to_prop_keys(t, alias_rhs, interface_keys, memo, stack)),
        ),
        TSType::TSIntersectionType(i) => merge_prop_vecs(
            i.types
                .iter()
                .map(|t| expand_type_to_prop_keys(t, alias_rhs, interface_keys, memo, stack)),
        ),
        _ => Vec::new(),
    }
}

fn props_from_ts_type(
    ty: &TSType<'_>,
    shapes: &HashMap<String, Vec<String>>,
    visiting: &mut HashSet<String>,
) -> Vec<String> {
    let ty = ty.without_parenthesized();
    match ty {
        TSType::TSTypeLiteral(lit) => keys_from_type_literal(lit),
        TSType::TSTypeReference(r) => {
            let Some(sym) = type_reference_root_name(&r.type_name) else {
                return Vec::new();
            };
            if visiting.contains(sym) {
                return Vec::new();
            }
            visiting.insert(sym.to_string());
            let out = shapes.get(sym).cloned().unwrap_or_default();
            visiting.remove(sym);
            out
        }
        TSType::TSUnionType(u) => merge_prop_vecs(
            u.types
                .iter()
                .map(|t| props_from_ts_type(t, shapes, visiting)),
        ),
        TSType::TSIntersectionType(i) => merge_prop_vecs(
            i.types
                .iter()
                .map(|t| props_from_ts_type(t, shapes, visiting)),
        ),
        _ => Vec::new(),
    }
}
