//! ECMAScript / TypeScript / JSX parsing via Oxc.

use std::collections::{BTreeMap, HashMap, HashSet};

use crate::cva_extract::{self, CvaBinding};
use std::path::{Path, PathBuf};

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    Argument, BindingPatternKind, Declaration, ExportDefaultDeclarationKind, Expression,
    FormalParameters, Function, JSXAttribute, JSXAttributeItem, JSXAttributeName,
    JSXAttributeValue, JSXChild, JSXElement, JSXElementName, JSXMemberExpressionObject,
    JSXOpeningElement, PropertyKey, VariableDeclarator,
};
use oxc_ast::visit::walk;
use oxc_ast::Visit;
use oxc_parser::{Parser, ParserReturn};
use oxc_span::SourceType;
use oxc_syntax::scope::ScopeFlags;

use crate::import_filter::{self, ImportFilter};
use crate::lines::{line_of_offset, newline_offsets};
use crate::model::{
    ComponentDefinition, DefinitionKind, FileScan, JsxUsage, LintFinding, Severity,
};
use crate::util::a11y;

const DEFAULT_EXPORT: &str = "default";

/// Analyze ECMA/JSX with diagnostics attributed to `report_path` (e.g. real `.vue` path).
///
/// `parse_as_path` selects [`SourceType`] (often a pseudo `.tsx` path for Vue script).
/// When `include_text_code_quality` is false, only AST code-quality rules run — caller should run
/// [`crate::code_quality::collect_text_code_quality`] on the full file (e.g. entire `.vue` source).
pub fn analyze_ecma_for_paths(
    report_path: &Path,
    parse_as_path: &Path,
    source: &str,
    include_text_code_quality: bool,
    import_filter: &ImportFilter,
) -> FileScan {
    let allocator = Allocator::default();
    let source_type = SourceType::from_path(parse_as_path).unwrap_or_else(|_| SourceType::tsx());
    let ParserReturn {
        program,
        errors,
        panicked,
        ..
    } = Parser::new(&allocator, source, source_type).parse();

    let parse_errors: Vec<String> = errors.iter().map(ToString::to_string).collect();
    if panicked {
        let mut scan = FileScan::empty(report_path.to_path_buf());
        scan.parse_errors = parse_errors;
        return scan;
    }

    let ts_prop_shapes = crate::ts_shape_map::collect_ts_prop_shape_map(&program);
    let cva_bindings = cva_extract::collect_cva_bindings(&program);
    let external_jsx_bindings = import_filter.external_jsx_bindings_from_program(&program);
    let newlines = newline_offsets(source);
    let mut v = ExtractVisitor {
        path: report_path.to_path_buf(),
        newlines: &newlines,
        definitions: Vec::new(),
        usages: Vec::new(),
        findings: Vec::new(),
        fn_depth: 0,
        ts_prop_shapes,
        cva_bindings,
        export_wrapped_component_spans: HashSet::new(),
        external_jsx_bindings,
    };
    v.visit_program(&program);

    let mut findings = v.findings;
    findings.extend(crate::code_quality::collect_ast_code_quality(
        report_path,
        source,
        &program,
    ));
    if include_text_code_quality {
        findings.extend(crate::code_quality::collect_text_code_quality(
            report_path,
            source,
        ));
    }

    let ast_extracts = crate::class_strings::collect_ast_extracts(source, &program);

    FileScan {
        path: report_path.to_path_buf(),
        definitions: v.definitions,
        usages: v.usages,
        parse_errors,
        findings,
        ast_extracts,
    }
}

pub fn analyze_ecma_file(path: &Path, source: &str) -> FileScan {
    analyze_ecma_for_paths(path, path, source, true, &ImportFilter::default())
}

pub fn analyze_ecma_file_with_filter(
    path: &Path,
    source: &str,
    import_filter: &ImportFilter,
) -> FileScan {
    analyze_ecma_for_paths(path, path, source, true, import_filter)
}

fn binding_name(id: &oxc_ast::ast::BindingIdentifier<'_>) -> String {
    id.name.as_str().to_string()
}

/// Extract prop names from the first parameter's object-destructure pattern.
///
/// Handles `function Button({ variant, size }: P)` and `({ variant }) => ...`.
fn extract_props_from_params(params: &FormalParameters<'_>) -> Vec<String> {
    let Some(first) = params.items.first() else {
        return Vec::new();
    };
    let BindingPatternKind::ObjectPattern(obj) = &first.pattern.kind else {
        return Vec::new();
    };
    let mut props: Vec<String> = Vec::new();
    for p in &obj.properties {
        if let PropertyKey::StaticIdentifier(id) = &p.key {
            props.push(id.name.as_str().to_string());
        } else if p.shorthand {
            if let BindingPatternKind::BindingIdentifier(id) = &p.value.kind {
                props.push(binding_name(id));
            }
        }
    }
    props
}

fn first_param_object_pattern<'a>(
    params: &'a FormalParameters<'_>,
) -> Option<&'a oxc_ast::ast::ObjectPattern<'a>> {
    let first = params.items.first()?;
    let BindingPatternKind::ObjectPattern(obj) = &first.pattern.kind else {
        return None;
    };
    Some(obj)
}

fn rest_binding_name(params: &FormalParameters<'_>) -> Option<String> {
    let obj = first_param_object_pattern(params)?;
    let rest = obj.rest.as_ref()?;
    let BindingPatternKind::BindingIdentifier(id) = &rest.argument.kind else {
        return None;
    };
    Some(binding_name(id))
}

/// Drop duplicate prop names while keeping the first occurrence (destructure order, then type keys).
fn dedupe_props_preserve_order(keys: &mut Vec<String>) {
    let mut seen = HashSet::new();
    keys.retain(|k| seen.insert(k.clone()));
}

fn merge_declared_props(
    params: &FormalParameters<'_>,
    ts_shapes: &HashMap<String, Vec<String>>,
) -> Vec<String> {
    let rest_name = rest_binding_name(params);
    let mut keys = extract_props_from_params(params);
    // When the param uses `...rest`, only explicit destructured names are API surface
    // (the rest binding is an object passthrough, not a string prop consumers pass).
    if rest_name.is_none() {
        keys.extend(crate::ts_shape_map::props_from_first_param_type_annotation(
            params, ts_shapes,
        ));
        if crate::ts_shape_map::children_from_first_param_type_annotation(params)
            && !keys.iter().any(|k| k == "children")
        {
            keys.push("children".to_string());
        }
    }
    dedupe_props_preserve_order(&mut keys);
    keys
}

fn merge_prop_options_for_component(
    params: &FormalParameters<'_>,
    cva_bindings: &HashMap<String, CvaBinding>,
    declared_props: &[String],
) -> (BTreeMap<String, Vec<String>>, BTreeMap<String, String>) {
    let (mut options, mut defaults) = cva_extract::prop_options_from_params(params, cva_bindings);
    if options.is_empty() && !cva_bindings.is_empty() {
        for prop in declared_props {
            for cva in cva_bindings.values() {
                if let Some(opts) = cva.variant_options.get(prop) {
                    options.insert(prop.clone(), opts.clone());
                    if let Some(d) = cva.default_variants.get(prop) {
                        defaults.insert(prop.clone(), d.clone());
                    }
                    break;
                }
            }
        }
    }
    (options, defaults)
}

fn component_definition_from_params(
    name: String,
    kind: DefinitionKind,
    line: u32,
    params: &FormalParameters<'_>,
    ts_shapes: &HashMap<String, Vec<String>>,
    cva_bindings: &HashMap<String, CvaBinding>,
) -> ComponentDefinition {
    let declared_props = merge_declared_props(params, ts_shapes);
    let (declared_prop_options, declared_prop_defaults) =
        merge_prop_options_for_component(params, cva_bindings, &declared_props);
    let cva_binding_name = cva_extract::cva_binding_name_from_params(params);
    ComponentDefinition {
        name,
        kind,
        line,
        declared_props,
        declared_prop_options,
        declared_prop_defaults,
        cva_binding_name,
    }
}

fn is_component_identifier(name: &str) -> bool {
    name.chars().next().is_some_and(|c| c.is_ascii_uppercase())
}

fn jsx_name(name: &JSXElementName<'_>) -> Option<String> {
    match name {
        JSXElementName::Identifier(id) => Some(id.name.as_str().to_string()),
        JSXElementName::IdentifierReference(id) => Some(id.name.as_str().to_string()),
        JSXElementName::MemberExpression(member) => {
            let obj = jsx_member_object(&member.object)?;
            Some(format!("{}.{}", obj, member.property.name.as_str()))
        }
        JSXElementName::NamespacedName(ns) => Some(format!(
            "{}:{}",
            ns.namespace.name.as_str(),
            ns.property.name.as_str()
        )),
        JSXElementName::ThisExpression(_) => Some("this".to_string()),
    }
}

fn jsx_member_object(obj: &JSXMemberExpressionObject<'_>) -> Option<String> {
    match obj {
        JSXMemberExpressionObject::IdentifierReference(id) => Some(id.name.as_str().to_string()),
        JSXMemberExpressionObject::MemberExpression(member) => {
            let base = jsx_member_object(&member.object)?;
            Some(format!("{}.{}", base, member.property.name.as_str()))
        }
        JSXMemberExpressionObject::ThisExpression(_) => Some("this".to_string()),
    }
}

fn usage_is_design_component(full_name: &str) -> bool {
    full_name
        .split('.')
        .next()
        .is_some_and(is_component_identifier)
}

/// Lowercase intrinsic JSX tag (`div`, `img`, …), excluding PascalCase components.
fn jsx_intrinsic_tag<'a>(name: &'a JSXElementName<'a>) -> Option<&'a str> {
    match name {
        JSXElementName::Identifier(id) => {
            let n = id.name.as_str();
            if n.chars().next().is_some_and(|c| c.is_ascii_lowercase()) {
                Some(n)
            } else {
                None
            }
        }
        _ => None,
    }
}

fn props_from_attributes(items: &[JSXAttributeItem<'_>]) -> Vec<String> {
    let mut props = Vec::new();
    for item in items {
        let JSXAttributeItem::Attribute(attr) = item else {
            continue;
        };
        match &attr.name {
            JSXAttributeName::Identifier(id) => props.push(id.name.as_str().to_string()),
            JSXAttributeName::NamespacedName(ns) => {
                props.push(format!(
                    "{}:{}",
                    ns.namespace.name.as_str(),
                    ns.property.name.as_str()
                ));
            }
        }
    }
    props.sort();
    props.dedup();
    props
}

fn literal_value_from_jsx_attr_value(value: &Option<JSXAttributeValue<'_>>) -> Option<String> {
    match value {
        None => Some("true".to_string()), // boolean shorthand: <Comp disabled />
        Some(JSXAttributeValue::StringLiteral(s)) => Some(s.value.to_string()),
        Some(JSXAttributeValue::ExpressionContainer(expr)) => {
            let inner = expr.expression.as_expression()?;
            match inner {
                Expression::StringLiteral(s) => Some(s.value.to_string()),
                Expression::NumericLiteral(n) => Some(n.value.to_string()),
                Expression::BooleanLiteral(b) => Some(b.value.to_string()),
                Expression::NullLiteral(_) => Some("null".to_string()),
                Expression::Identifier(id) if id.name.as_str() == "undefined" => {
                    Some("undefined".to_string())
                }
                Expression::TemplateLiteral(tpl) if tpl.expressions.is_empty() => {
                    // Treat as a string when it's fully static.
                    let cooked = tpl
                        .quasis
                        .iter()
                        .map(|q| q.value.cooked.as_deref().unwrap_or(""))
                        .collect::<Vec<_>>()
                        .join("");
                    Some(cooked)
                }
                _ => None,
            }
        }
        _ => None,
    }
}

fn prop_values_from_attributes(items: &[JSXAttributeItem<'_>]) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for item in items {
        let JSXAttributeItem::Attribute(attr) = item else {
            continue;
        };

        let key = match &attr.name {
            JSXAttributeName::Identifier(id) => id.name.as_str().to_string(),
            JSXAttributeName::NamespacedName(ns) => format!(
                "{}:{}",
                ns.namespace.name.as_str(),
                ns.property.name.as_str()
            ),
        };

        let Some(val) = literal_value_from_jsx_attr_value(&attr.value) else {
            continue;
        };

        // If a prop is repeated (invalid JSX, but possible in malformed files), keep the first.
        out.entry(key).or_insert(val);
    }
    out
}

fn expr_is_component_like(expr: &Expression<'_>) -> bool {
    matches!(
        expr,
        Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)
    )
}

fn wrapper_callee_name<'a>(callee: &'a Expression<'a>) -> Option<&'a str> {
    match callee {
        Expression::Identifier(ident) => Some(ident.name.as_str()),
        Expression::StaticMemberExpression(mem) => Some(mem.property.name.as_str()),
        _ => None,
    }
}

fn is_wrapper_callee_name(name: &str) -> bool {
    matches!(name, "forwardRef" | "memo" | "observer" | "connect")
}

fn expr_is_wrapper_call(expr: &Expression<'_>) -> bool {
    let Expression::CallExpression(call) = expr else {
        return false;
    };
    wrapper_callee_name(&call.callee).is_some_and(is_wrapper_callee_name)
}

fn params_from_wrapper_argument<'a>(arg: &'a Argument<'a>) -> Option<&'a FormalParameters<'a>> {
    match arg {
        Argument::ArrowFunctionExpression(arrow) => Some(&arrow.params),
        Argument::FunctionExpression(func) => Some(&func.params),
        _ => None,
    }
}

fn params_from_wrapper_call<'a>(expr: &'a Expression<'a>) -> Option<&'a FormalParameters<'a>> {
    let Expression::CallExpression(call) = expr else {
        return None;
    };
    if !expr_is_wrapper_call(expr) {
        return None;
    }
    let first = call.arguments.first()?;
    params_from_wrapper_argument(first)
}

fn has_spread_attribute(items: &[JSXAttributeItem<'_>]) -> bool {
    items
        .iter()
        .any(|item| matches!(item, JSXAttributeItem::SpreadAttribute(_)))
}

fn jsx_attr<'a>(items: &'a [JSXAttributeItem<'a>], want: &str) -> Option<&'a JSXAttribute<'a>> {
    for item in items {
        let JSXAttributeItem::Attribute(attr) = item else {
            continue;
        };
        let JSXAttributeName::Identifier(id) = &attr.name else {
            continue;
        };
        if id.name.as_str() == want {
            return Some(attr);
        }
    }
    None
}

fn has_named_attribute(items: &[JSXAttributeItem<'_>], name: &str) -> bool {
    jsx_attr(items, name).is_some()
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum HrefA11y {
    Ok,
    Missing,
    Placeholder,
    Skip,
}

fn href_accessibility(attrs: &[JSXAttributeItem<'_>]) -> HrefA11y {
    let Some(attr) = jsx_attr(attrs, "href") else {
        return HrefA11y::Missing;
    };
    match &attr.value {
        None => HrefA11y::Placeholder,
        Some(JSXAttributeValue::StringLiteral(s)) => {
            let v = s.value.trim();
            if v.is_empty() || v == "#" {
                return HrefA11y::Placeholder;
            }
            let lower = v.to_ascii_lowercase();
            if lower.starts_with("javascript:") {
                return HrefA11y::Placeholder;
            }
            HrefA11y::Ok
        }
        Some(JSXAttributeValue::ExpressionContainer(_)) => HrefA11y::Skip,
        Some(JSXAttributeValue::Element(_) | JSXAttributeValue::Fragment(_)) => HrefA11y::Skip,
    }
}

fn input_is_hidden(attrs: &[JSXAttributeItem<'_>]) -> bool {
    let Some(attr) = jsx_attr(attrs, "type") else {
        return false;
    };
    match &attr.value {
        Some(JSXAttributeValue::StringLiteral(s)) => s.value.trim().eq_ignore_ascii_case("hidden"),
        _ => false,
    }
}

fn non_empty_string_literal_attr(attrs: &[JSXAttributeItem<'_>], name: &str) -> bool {
    let Some(attr) = jsx_attr(attrs, name) else {
        return false;
    };
    match &attr.value {
        Some(JSXAttributeValue::StringLiteral(s)) => !s.value.trim().is_empty(),
        Some(JSXAttributeValue::ExpressionContainer(_)) => true,
        _ => false,
    }
}

/// True when JSX element content would pass `children` in React (text, nested nodes, or expressions).
fn jsx_has_child_content(children: &[JSXChild<'_>]) -> bool {
    for child in children {
        match child {
            JSXChild::Text(t) => {
                if !t.value.trim().is_empty() {
                    return true;
                }
            }
            JSXChild::Element(_) | JSXChild::Fragment(_) => return true,
            JSXChild::ExpressionContainer(_) => return true,
            JSXChild::Spread(_) => {}
        }
    }
    false
}

fn jsx_children_have_visible_text(children: &[JSXChild<'_>]) -> bool {
    jsx_has_child_content(children)
}

fn props_from_jsx_element(
    attributes: &[JSXAttributeItem<'_>],
    children: &[JSXChild<'_>],
) -> Vec<String> {
    let mut props = props_from_attributes(attributes);
    if jsx_has_child_content(children) && !props.iter().any(|p| p == "children") {
        props.push("children".to_string());
    }
    props.sort();
    props.dedup();
    props
}

fn button_has_accessible_name(attrs: &[JSXAttributeItem<'_>], children: &[JSXChild<'_>]) -> bool {
    if non_empty_string_literal_attr(attrs, "aria-label") {
        return true;
    }
    if has_named_attribute(attrs, "aria-labelledby") {
        return true;
    }
    if non_empty_string_literal_attr(attrs, "title") {
        return true;
    }
    jsx_children_have_visible_text(children)
}

struct ExtractVisitor<'nl> {
    path: PathBuf,
    /// Precomputed newline offsets for O(log n) line-number lookup.
    newlines: &'nl [usize],
    definitions: Vec<ComponentDefinition>,
    usages: Vec<JsxUsage>,
    findings: Vec<LintFinding>,
    fn_depth: u32,
    ts_prop_shapes: HashMap<String, Vec<String>>,
    cva_bindings: HashMap<String, CvaBinding>,
    /// `export function Foo` is recorded here first so `visit_function` does not duplicate it.
    export_wrapped_component_spans: HashSet<(u32, u32)>,
    /// JSX roots (`SheetPrimitive`, …) bound to third-party imports in this file.
    external_jsx_bindings: HashSet<String>,
}

impl ExtractVisitor<'_> {
    fn line(&self, offset: u32) -> u32 {
        line_of_offset(self.newlines, offset as usize)
    }

    fn push_a11y(&mut self, line: u32, severity: Severity, rule_id: &str, message: &str) {
        self.findings.push(LintFinding::new(
            rule_id,
            self.path.clone(),
            Some(line),
            severity,
            message,
        ));
    }

    fn check_intrinsic_a11y_opening(&mut self, el: &JSXOpeningElement<'_>) {
        if has_spread_attribute(&el.attributes) {
            return;
        }
        let Some(tag) = jsx_intrinsic_tag(&el.name) else {
            return;
        };
        let line = self.line(el.span.start);
        match tag {
            "img" if !has_named_attribute(&el.attributes, "alt") => {
                self.push_a11y(
                    line,
                    Severity::Warning,
                    "a11y-img-alt",
                    a11y::IMG_ALT,
                );
            }
            "a" => match href_accessibility(&el.attributes) {
                HrefA11y::Missing => self.push_a11y(
                    line,
                    Severity::Warning,
                    "a11y-anchor-href",
                    a11y::ANCHOR_HREF,
                ),
                HrefA11y::Placeholder => self.push_a11y(
                    line,
                    Severity::Warning,
                    "a11y-anchor-placeholder-href",
                    a11y::ANCHOR_PLACEHOLDER_HREF,
                ),
                HrefA11y::Ok | HrefA11y::Skip => {}
            },
            "input" => {
                if input_is_hidden(&el.attributes) {
                    return;
                }
                if !has_named_attribute(&el.attributes, "aria-label")
                    && !has_named_attribute(&el.attributes, "aria-labelledby")
                {
                    self.push_a11y(
                        line,
                        Severity::Info,
                        "a11y-input-label",
                        a11y::INPUT_LABEL,
                    );
                }
            }
            _ => {}
        }
    }
}

impl<'a> Visit<'a> for ExtractVisitor<'_> {
    fn visit_export_named_declaration(&mut self, decl: &oxc_ast::ast::ExportNamedDeclaration<'a>) {
        if let Some(Declaration::FunctionDeclaration(func)) = &decl.declaration {
            if let Some(id) = &func.id {
                let name = binding_name(id);
                if is_component_identifier(&name) {
                    self
                        .export_wrapped_component_spans
                        .insert((func.span.start, func.span.end));
                    self.definitions.push(component_definition_from_params(
                        name,
                        DefinitionKind::Function,
                        self.line(func.span.start),
                        &func.params,
                        &self.ts_prop_shapes,
                        &self.cva_bindings,
                    ));
                }
            }
        }
        walk::walk_export_named_declaration(self, decl);
    }

    fn visit_function(&mut self, func: &Function<'a>, flags: ScopeFlags) {
        self.fn_depth += 1;
        if self.fn_depth == 1 {
            if let Some(id) = &func.id {
                let name = binding_name(id);
                if is_component_identifier(&name)
                    && !self
                        .export_wrapped_component_spans
                        .contains(&(func.span.start, func.span.end))
                {
                    self.definitions.push(component_definition_from_params(
                        name,
                        DefinitionKind::Function,
                        self.line(func.span.start),
                        &func.params,
                        &self.ts_prop_shapes,
                        &self.cva_bindings,
                    ));
                }
            }
        }
        walk::walk_function(self, func, flags);
        self.fn_depth -= 1;
    }

    fn visit_arrow_function_expression(
        &mut self,
        expr: &oxc_ast::ast::ArrowFunctionExpression<'a>,
    ) {
        self.fn_depth += 1;
        walk::walk_arrow_function_expression(self, expr);
        self.fn_depth -= 1;
    }

    fn visit_class(&mut self, class: &oxc_ast::ast::Class<'a>) {
        if self.fn_depth == 0 {
            if let Some(id) = &class.id {
                let name = binding_name(id);
                if is_component_identifier(&name) {
                    self.definitions.push(ComponentDefinition {
                        name,
                        kind: DefinitionKind::Class,
                        line: self.line(class.span.start),
                        declared_props: Vec::new(),
                        declared_prop_options: BTreeMap::new(),
                        declared_prop_defaults: BTreeMap::new(),
                        cva_binding_name: None,
                    });
                }
            }
        }
        walk::walk_class(self, class);
    }

    fn visit_variable_declarator(&mut self, decl: &VariableDeclarator<'a>) {
        if self.fn_depth == 0 {
            self.try_record_component_binding(decl);
        }
        walk::walk_variable_declarator(self, decl);
    }

    fn visit_export_default_declaration(
        &mut self,
        decl: &oxc_ast::ast::ExportDefaultDeclaration<'a>,
    ) {
        match &decl.declaration {
            ExportDefaultDeclarationKind::FunctionDeclaration(func) if func.id.is_none() => {
                self.definitions.push(component_definition_from_params(
                    DEFAULT_EXPORT.to_string(),
                    DefinitionKind::ExportDefaultAnonymous,
                    self.line(decl.span.start),
                    &func.params,
                    &self.ts_prop_shapes,
                    &self.cva_bindings,
                ));
            }
            ExportDefaultDeclarationKind::ArrowFunctionExpression(arrow) => {
                self.definitions.push(component_definition_from_params(
                    DEFAULT_EXPORT.to_string(),
                    DefinitionKind::ExportDefaultAnonymous,
                    self.line(decl.span.start),
                    &arrow.params,
                    &self.ts_prop_shapes,
                    &self.cva_bindings,
                ));
            }
            ExportDefaultDeclarationKind::FunctionExpression(func) => {
                self.definitions.push(component_definition_from_params(
                    DEFAULT_EXPORT.to_string(),
                    DefinitionKind::ExportDefaultAnonymous,
                    self.line(decl.span.start),
                    &func.params,
                    &self.ts_prop_shapes,
                    &self.cva_bindings,
                ));
            }
            ExportDefaultDeclarationKind::Identifier(ident) => {
                let name = format!("default→{}", ident.name.as_str());
                self.definitions.push(ComponentDefinition {
                    name,
                    kind: DefinitionKind::ExportDefault,
                    line: self.line(decl.span.start),
                    declared_props: Vec::new(),
                    declared_prop_options: BTreeMap::new(),
                    declared_prop_defaults: BTreeMap::new(),
                    cva_binding_name: None,
                });
            }
            _ => {}
        }
        walk::walk_export_default_declaration(self, decl);
    }

    fn visit_jsx_element(&mut self, el: &JSXElement<'a>) {
        if jsx_intrinsic_tag(&el.opening_element.name) == Some("button")
            && !has_spread_attribute(&el.opening_element.attributes)
            && !button_has_accessible_name(&el.opening_element.attributes, &el.children)
        {
            let line = self.line(el.opening_element.span.start);
            self.push_a11y(
                line,
                Severity::Warning,
                "a11y-button-name",
                a11y::BUTTON_NAME,
            );
        }

        if let Some(component) = jsx_name(&el.opening_element.name) {
            if usage_is_design_component(&component)
                && !import_filter::usage_root_is_external(&component, &self.external_jsx_bindings)
            {
                let props = props_from_jsx_element(&el.opening_element.attributes, &el.children);
                let prop_values = prop_values_from_attributes(&el.opening_element.attributes);
                self.usages.push(JsxUsage {
                    component,
                    line: self.line(el.opening_element.span.start),
                    props,
                    prop_values,
                });
            }
        }

        walk::walk_jsx_element(self, el);
    }

    fn visit_jsx_opening_element(&mut self, el: &JSXOpeningElement<'a>) {
        self.check_intrinsic_a11y_opening(el);
        walk::walk_jsx_opening_element(self, el);
    }
}

impl ExtractVisitor<'_> {
    fn try_record_component_binding(&mut self, decl: &VariableDeclarator<'_>) {
        let BindingPatternKind::BindingIdentifier(id) = &decl.id.kind else {
            return;
        };
        let name = binding_name(id);
        if !is_component_identifier(&name) {
            return;
        }
        let Some(init) = &decl.init else {
            return;
        };
        if expr_is_component_like(init) {
            let (kind, params) = match init {
                Expression::ArrowFunctionExpression(arrow) => {
                    (DefinitionKind::ConstArrow, &arrow.params)
                }
                Expression::FunctionExpression(func) => {
                    (DefinitionKind::ConstFunction, &func.params)
                }
                _ => return,
            };
            self.definitions.push(component_definition_from_params(
                name,
                kind,
                self.line(decl.span.start),
                params,
                &self.ts_prop_shapes,
                &self.cva_bindings,
            ));
        } else if expr_is_wrapper_call(init) {
            if let Some(params) = params_from_wrapper_call(init) {
                self.definitions.push(component_definition_from_params(
                    name,
                    DefinitionKind::WrappedComponent,
                    self.line(decl.span.start),
                    params,
                    &self.ts_prop_shapes,
                    &self.cva_bindings,
                ));
            } else {
                self.definitions.push(ComponentDefinition {
                    name,
                    kind: DefinitionKind::WrappedComponent,
                    line: self.line(decl.span.start),
                    declared_props: Vec::new(),
                    declared_prop_options: BTreeMap::new(),
                    declared_prop_defaults: BTreeMap::new(),
                    cva_binding_name: None,
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn extracts_definitions_and_usages() {
        let src = r#"
import { Button } from "./ds";

export function Hero() {
  return (
    <section>
      <Button variant="primary" />
      <div />
    </section>
  );
}

const Panel = () => <aside />;
"#;
        let scan = analyze_ecma_file(&PathBuf::from("Hero.tsx"), src);
        assert!(scan.parse_errors.is_empty(), "{:?}", scan.parse_errors);
        let def_names: Vec<_> = scan.definitions.iter().map(|d| d.name.as_str()).collect();
        assert!(def_names.contains(&"Hero"));
        assert!(def_names.contains(&"Panel"));
        let used: Vec<_> = scan.usages.iter().map(|u| u.component.as_str()).collect();
        assert!(used.contains(&"Button"));
        assert!(!used.contains(&"div"));
    }

    #[test]
    fn a11y_img_requires_alt() {
        let src = r#"export function X() { return <img src="a.png" />; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(
            scan.findings.iter().any(|f| f.rule_id == "a11y-img-alt"),
            "{:?}",
            scan.findings
        );
    }

    #[test]
    fn a11y_img_alt_present_ok() {
        let src = r#"export function X() { return <img src="a.png" alt="" />; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(!scan.findings.iter().any(|f| f.rule_id == "a11y-img-alt"));
    }

    #[test]
    fn a11y_anchor_requires_href() {
        let src = r#"export function X() { return <a>click</a>; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(
            scan.findings
                .iter()
                .any(|f| f.rule_id == "a11y-anchor-href"),
            "{:?}",
            scan.findings
        );
    }

    #[test]
    fn a11y_button_requires_name() {
        let src = r#"export function X() { return <button type="button" />; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(
            scan.findings
                .iter()
                .any(|f| f.rule_id == "a11y-button-name"),
            "{:?}",
            scan.findings
        );
    }

    #[test]
    fn a11y_button_with_aria_label_ok() {
        let src =
            r#"export function X() { return <button type="button" aria-label="Close" />; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(!scan.findings.iter().any(|f| f.rule_id == "a11y-button-name"));
    }

    #[test]
    fn a11y_button_with_children_ok() {
        let src = r#"export function X() { return <button type="button">Save</button>; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(!scan.findings.iter().any(|f| f.rule_id == "a11y-button-name"));
    }

    #[test]
    fn a11y_input_label_info() {
        let src = r#"export function X() { return <input type="text" />; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(
            scan.findings
                .iter()
                .any(|f| f.rule_id == "a11y-input-label"),
            "{:?}",
            scan.findings
        );
    }

    #[test]
    fn a11y_hidden_input_skips_label() {
        let src = r#"export function X() { return <input type="hidden" />; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(!scan.findings.iter().any(|f| f.rule_id == "a11y-input-label"));
    }

    #[test]
    fn a11y_anchor_placeholder_href() {
        let src = r##"export function X() { return <a href="#">link</a>; }"##;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(
            scan.findings
                .iter()
                .any(|f| f.rule_id == "a11y-anchor-placeholder-href"),
            "{:?}",
            scan.findings
        );
    }

    #[test]
    fn a11y_anchor_valid_href_ok() {
        let src = r#"export function X() { return <a href="/home">link</a>; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(
            !scan
                .findings
                .iter()
                .any(|f| f.rule_id.starts_with("a11y-anchor")),
            "{:?}",
            scan.findings
        );
    }

    #[test]
    fn a11y_spread_skips_intrinsic_checks() {
        let src = r#"export function X() { return <img {...props} />; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("x.tsx"), src);
        assert!(!scan.findings.iter().any(|f| f.rule_id == "a11y-img-alt"));
    }

    #[test]
    fn cva_binding_name_on_variant_props_component() {
        let src = r#"
const buttonVariants = cva("base", {
  variants: { variant: { default: "a", destructive: "b" } },
  defaultVariants: { variant: "default" },
});
function Button({ variant }: VariantProps<typeof buttonVariants>) {
  return null;
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("button.tsx"), src);
        let btn = scan.definitions.iter().find(|d| d.name == "Button").unwrap();
        assert_eq!(
            btn.cva_binding_name.as_deref(),
            Some("buttonVariants")
        );
    }

    #[test]
    fn declared_props_keeps_classname_and_rest_binding_without_type_expansion() {
        let src = r#"
function Checkbox({
  className,
  checked,
  ...props
}: React.ComponentProps<"input">) {
  return null;
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("Checkbox.tsx"), src);
        let cb = scan
            .definitions
            .iter()
            .find(|d| d.name == "Checkbox")
            .expect("Checkbox definition");
        assert!(cb.declared_props.contains(&"className".to_string()));
        assert!(cb.declared_props.contains(&"checked".to_string()));
        assert!(!cb.declared_props.contains(&"props".to_string()));
        assert!(!cb.declared_props.contains(&"type".to_string()));
    }

    #[test]
    fn declared_props_extracted_from_destructured_function() {
        let src = r#"
export function Button({ variant, size, onClick }: ButtonProps) {
  return <button />;
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("Button.tsx"), src);
        assert!(scan.parse_errors.is_empty(), "{:?}", scan.parse_errors);
        let btn = scan
            .definitions
            .iter()
            .find(|d| d.name == "Button")
            .expect("Button definition");
        assert_eq!(btn.declared_props, vec!["variant", "size", "onClick"]);
    }

    #[test]
    fn declared_props_extracted_from_arrow_component() {
        let src = r#"
export const Card = ({ title, body }: CardProps) => <div>{title}</div>;
"#;
        let scan = analyze_ecma_file(&PathBuf::from("Card.tsx"), src);
        assert!(scan.parse_errors.is_empty(), "{:?}", scan.parse_errors);
        let card = scan
            .definitions
            .iter()
            .find(|d| d.name == "Card")
            .expect("Card definition");
        assert_eq!(card.declared_props, vec!["title", "body"]);
    }

    #[test]
    fn declared_props_from_typed_non_destructured_param() {
        let src = r#"
export type LabelProps = { text: string };
export function Label(props: LabelProps) {
  return <span>{props.text}</span>;
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("Label.tsx"), src);
        let label = scan
            .definitions
            .iter()
            .find(|d| d.name == "Label")
            .expect("Label definition");
        assert_eq!(label.declared_props, vec!["text"]);
    }

    #[test]
    fn declared_props_merge_destructure_and_props_type() {
        let src = r#"
export type BtnProps = { variant?: string; size?: string };
export function Button({ onClick }: { onClick: () => void } & BtnProps) {
  return <button onClick={onClick} />;
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("Button.tsx"), src);
        let btn = scan
            .definitions
            .iter()
            .find(|d| d.name == "Button")
            .expect("Button definition");
        assert_eq!(btn.declared_props, vec!["onClick", "variant", "size"]);
    }

    #[test]
    fn cva_variant_options_on_intersection_variant_props() {
        let src = r#"
const buttonVariants = cva("base", {
  variants: {
    variant: { default: "a", destructive: "b", outline: "c" },
    size: { default: "d", sm: "e", lg: "f" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
function Button({
  className,
  variant,
  size,
  asChild = false,
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  return <button className={className} />;
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("button.tsx"), src);
        let btn = scan
            .definitions
            .iter()
            .find(|d| d.name == "Button")
            .expect("Button");
        assert_eq!(
            btn.declared_prop_options.get("variant").map(|v| v.as_slice()),
            Some(&["default".to_string(), "destructive".to_string(), "outline".to_string()][..])
        );
        assert_eq!(
            btn.declared_prop_defaults.get("variant").map(String::as_str),
            Some("default")
        );
        assert!(
            btn.declared_props.contains(&"children".to_string()),
            "ComponentProps<\"button\"> should imply children"
        );
    }

    #[test]
    fn react_forward_ref_anonymous_arrow_extracts_props() {
        let src = r#"
const buttonVariants = cva("base", {
  variants: {
    variant: { default: "a", destructive: "b", outline: "c" },
    size: { default: "d", sm: "e", lg: "f" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return <button className={className} ref={ref} {...props} />;
  },
);
export { Button };
"#;
        let scan = analyze_ecma_file(&PathBuf::from("button.tsx"), src);
        let btn = scan
            .definitions
            .iter()
            .find(|d| d.name == "Button")
            .expect("Button definition");
        assert_eq!(btn.kind, DefinitionKind::WrappedComponent);
        for prop in ["className", "variant", "size", "asChild"] {
            assert!(
                btn.declared_props.contains(&prop.to_string()),
                "missing {prop}: {:?}",
                btn.declared_props
            );
        }
        assert!(
            !btn.declared_props.contains(&"props".to_string()),
            "rest binding should not become a declared prop"
        );
        assert_eq!(
            btn.declared_prop_options.get("variant").map(|v| v.as_slice()),
            Some(&["default".to_string(), "destructive".to_string(), "outline".to_string()][..])
        );
        assert_eq!(
            btn.declared_prop_options.get("size").map(|v| v.as_slice()),
            Some(&["default".to_string(), "sm".to_string(), "lg".to_string()][..])
        );
        assert_eq!(
            btn.declared_prop_defaults.get("variant").map(String::as_str),
            Some("default")
        );
    }

    #[test]
    fn forward_ref_import_extracts_props_from_inner_arrow() {
        let src = r#"
import { forwardRef } from "react";
const Input = forwardRef(({ className, type, ...props }, ref) => {
  return <input className={className} type={type} ref={ref} {...props} />;
});
export { Input };
"#;
        let scan = analyze_ecma_file(&PathBuf::from("input.tsx"), src);
        let input = scan
            .definitions
            .iter()
            .find(|d| d.name == "Input")
            .expect("Input definition");
        assert_eq!(input.kind, DefinitionKind::WrappedComponent);
        assert_eq!(input.declared_props, vec!["className", "type"]);
    }

    #[test]
    fn declared_props_export_function_with_leading_blank_and_type_alias() {
        let src = r#"

type Props = {
  children: React.ReactNode;
};

export function InlineCode({ children }: Props) {
  return <code>{children}</code>;
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("InlineCode.tsx"), src);
        let def = scan
            .definitions
            .iter()
            .find(|d| d.name == "InlineCode")
            .expect("InlineCode definition");
        assert_eq!(def.declared_props, vec!["children"]);
    }

    #[test]
    fn usage_records_children_from_jsx_content() {
        let src = r#"
export function Page() {
  return <FlexStack><p>x</p></FlexStack>;
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("Page.tsx"), src);
        let usage = scan
            .usages
            .iter()
            .find(|u| u.component == "FlexStack")
            .expect("FlexStack usage");
        assert!(usage.props.contains(&"children".to_string()));
    }

    #[test]
    fn usage_omits_children_for_self_closing() {
        let src = r#"export function Page() { return <FlexStack />; }"#;
        let scan = analyze_ecma_file(&PathBuf::from("Page.tsx"), src);
        let usage = scan
            .usages
            .iter()
            .find(|u| u.component == "FlexStack")
            .expect("FlexStack usage");
        assert!(!usage.props.contains(&"children".to_string()));
    }

    #[test]
    fn usage_skips_third_party_namespace_jsx_bindings() {
        let src = r#"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { CheckIcon } from "lucide-react"

function SheetContent() {
  return (
    <SheetPrimitive.Content>
      <SheetPrimitive.Close>
        <CheckIcon />
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  )
}

export { SheetContent }
"#;
        let scan = analyze_ecma_file(&PathBuf::from("sheet.tsx"), src);
        assert!(
            !scan
                .usages
                .iter()
                .any(|u| u.component.starts_with("SheetPrimitive")),
            "radix primitives should not appear as usages: {:?}",
            scan.usages
        );
        assert!(
            !scan.usages.iter().any(|u| u.component == "CheckIcon"),
            "lucide icons should not appear as usages: {:?}",
            scan.usages
        );
    }
}
