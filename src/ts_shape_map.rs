//! Best-effort extraction of component prop names from TypeScript types in the same file.
//!
//! Used to populate `declared_props` when the first parameter is not object-destructured
//! (e.g. `function X(props: XProps)`), by resolving `type` / `interface` declarations.

use std::collections::{HashMap, HashSet};

use oxc_ast::ast::{
    Declaration, ExportNamedDeclaration, FormalParameters, Program, PropertyKey, Statement,
    TSInterfaceBody, TSSignature, TSType, TSTypeLiteral, TSTypeName,
};

/// Map type name → unique property keys from object literals / interfaces / aliases (declaration order).
pub fn collect_ts_prop_shape_map(program: &Program<'_>) -> HashMap<String, Vec<String>> {
    let mut alias_rhs: HashMap<String, &TSType<'_>> = HashMap::new();
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

fn ingest_top_level_statement(
    stmt: &Statement<'_>,
    alias_rhs: &mut HashMap<String, &TSType<'_>>,
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

fn ingest_export_named(
    ex: &ExportNamedDeclaration<'_>,
    alias_rhs: &mut HashMap<String, &TSType<'_>>,
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

fn type_reference_root_name(type_name: &TSTypeName<'_>) -> Option<&str> {
    match type_name {
        TSTypeName::IdentifierReference(id) => Some(id.name.as_str()),
        TSTypeName::QualifiedName(qn) => Some(qn.right.name.as_str()),
    }
}

fn shape_for_symbol(
    sym: &str,
    alias_rhs: &HashMap<String, &TSType<'_>>,
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

fn expand_type_to_prop_keys(
    ty: &TSType<'_>,
    alias_rhs: &HashMap<String, &TSType<'_>>,
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
