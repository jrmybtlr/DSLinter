//! ECMAScript / TypeScript / JSX parsing via Oxc.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    BindingPatternKind, Declaration, ExportDefaultDeclarationKind, Expression, FormalParameters,
    Function, JSXAttribute, JSXAttributeItem, JSXAttributeName, JSXAttributeValue, JSXChild,
    JSXElement, JSXElementName, JSXMemberExpressionObject, JSXOpeningElement, PropertyKey,
    VariableDeclarator,
};
use oxc_ast::visit::walk;
use oxc_ast::Visit;
use oxc_parser::{Parser, ParserReturn};
use oxc_span::SourceType;
use oxc_syntax::scope::ScopeFlags;

use crate::model::{
    ComponentDefinition, DefinitionKind, FileScan, JsxUsage, LintFinding, Severity,
};

const DEFAULT_EXPORT: &str = "default";

/// Analyze ECMA/JSX with diagnostics attributed to `report_path` (e.g. real `.vue` path).
///
/// `parse_as_path` selects [`SourceType`] (often a pseudo `.tsx` path for Vue script).
/// When `include_text_smells` is false, only AST smells run — caller should run
/// [`crate::smells::collect_text_smells`] on the full file (e.g. entire `.vue` source).
pub fn analyze_ecma_for_paths(
    report_path: &Path,
    parse_as_path: &Path,
    source: &str,
    include_text_smells: bool,
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
        return FileScan {
            path: report_path.to_path_buf(),
            definitions: Vec::new(),
            usages: Vec::new(),
            parse_errors,
            findings: Vec::new(),
        };
    }

    let ts_prop_shapes = crate::ts_shape_map::collect_ts_prop_shape_map(&program);
    let mut v = ExtractVisitor {
        path: report_path.to_path_buf(),
        source,
        definitions: Vec::new(),
        usages: Vec::new(),
        findings: Vec::new(),
        fn_depth: 0,
        ts_prop_shapes,
        export_wrapped_component_spans: HashSet::new(),
    };
    v.visit_program(&program);

    let mut findings = v.findings;
    findings.extend(crate::smells::collect_ast_smells(
        report_path,
        source,
        &program,
    ));
    if include_text_smells {
        findings.extend(crate::smells::collect_text_smells(report_path, source));
    }

    FileScan {
        path: report_path.to_path_buf(),
        definitions: v.definitions,
        usages: v.usages,
        parse_errors,
        findings,
    }
}

pub fn analyze_ecma_file(path: &Path, source: &str) -> FileScan {
    analyze_ecma_for_paths(path, path, source, true)
}

fn offset_line(source: &str, offset: u32) -> u32 {
    let offset = offset as usize;
    if offset >= source.len() {
        return source.lines().count().max(1) as u32;
    }
    1 + source[..offset].bytes().filter(|&b| b == b'\n').count() as u32
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
    props.sort();
    props
}

fn merge_declared_props(
    params: &FormalParameters<'_>,
    ts_shapes: &HashMap<String, Vec<String>>,
) -> Vec<String> {
    let mut keys = extract_props_from_params(params);
    keys.extend(crate::ts_shape_map::props_from_first_param_type_annotation(
        params, ts_shapes,
    ));
    keys.sort();
    keys.dedup();
    keys
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

fn expr_is_component_like(expr: &Expression<'_>) -> bool {
    matches!(
        expr,
        Expression::ArrowFunctionExpression(_) | Expression::FunctionExpression(_)
    )
}

fn expr_is_wrapper_call(expr: &Expression<'_>) -> bool {
    let Expression::CallExpression(call) = expr else {
        return false;
    };
    let Expression::Identifier(ident) = &call.callee else {
        return false;
    };
    matches!(
        ident.name.as_str(),
        "forwardRef" | "memo" | "observer" | "connect"
    )
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

fn jsx_children_have_visible_text(children: &[JSXChild<'_>]) -> bool {
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

struct ExtractVisitor<'src> {
    path: PathBuf,
    source: &'src str,
    definitions: Vec<ComponentDefinition>,
    usages: Vec<JsxUsage>,
    findings: Vec<LintFinding>,
    fn_depth: u32,
    ts_prop_shapes: HashMap<String, Vec<String>>,
    /// `export function Foo` is recorded here first so `visit_function` does not duplicate it.
    export_wrapped_component_spans: HashSet<(u32, u32)>,
}

impl ExtractVisitor<'_> {
    fn push_a11y(&mut self, line: u32, severity: Severity, rule_id: &str, message: &str) {
        self.findings.push(LintFinding {
            rule_id: rule_id.to_string(),
            message: message.to_string(),
            path: self.path.clone(),
            line: Some(line),
            severity,
        });
    }

    fn check_intrinsic_a11y_opening(&mut self, el: &JSXOpeningElement<'_>) {
        if has_spread_attribute(&el.attributes) {
            return;
        }
        let Some(tag) = jsx_intrinsic_tag(&el.name) else {
            return;
        };
        let line = offset_line(self.source, el.span.start);
        match tag {
            "img" => {
                if !has_named_attribute(&el.attributes, "alt") {
                    self.push_a11y(
                        line,
                        Severity::Warning,
                        "a11y-img-alt",
                        "`<img>` must include an `alt` attribute (empty string is OK for decorative images).",
                    );
                }
            }
            "a" => match href_accessibility(&el.attributes) {
                HrefA11y::Missing => self.push_a11y(
                    line,
                    Severity::Warning,
                    "a11y-anchor-href",
                    "`<a>` must have a meaningful `href` for navigation.",
                ),
                HrefA11y::Placeholder => self.push_a11y(
                    line,
                    Severity::Warning,
                    "a11y-anchor-placeholder-href",
                    "Avoid empty `href`, `href=\"#\"`, or `javascript:` URLs without accessible behavior.",
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
                        "`<input>` should expose an accessible name (`aria-label`, `aria-labelledby`, or associated `<label htmlFor>`).",
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
                    let declared_props = merge_declared_props(&func.params, &self.ts_prop_shapes);
                    self.definitions.push(ComponentDefinition {
                        name,
                        kind: DefinitionKind::Function,
                        line: offset_line(self.source, func.span.start),
                        declared_props,
                    });
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
                    let declared_props =
                        merge_declared_props(&func.params, &self.ts_prop_shapes);
                    self.definitions.push(ComponentDefinition {
                        name,
                        kind: DefinitionKind::Function,
                        line: offset_line(self.source, func.span.start),
                        declared_props,
                    });
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
                        line: offset_line(self.source, class.span.start),
                        declared_props: Vec::new(),
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
            ExportDefaultDeclarationKind::FunctionDeclaration(func) => {
                if func.id.is_none() {
                    let declared_props =
                        merge_declared_props(&func.params, &self.ts_prop_shapes);
                    self.definitions.push(ComponentDefinition {
                        name: DEFAULT_EXPORT.to_string(),
                        kind: DefinitionKind::ExportDefaultAnonymous,
                        line: offset_line(self.source, decl.span.start),
                        declared_props,
                    });
                }
            }
            ExportDefaultDeclarationKind::ArrowFunctionExpression(arrow) => {
                let declared_props =
                    merge_declared_props(&arrow.params, &self.ts_prop_shapes);
                self.definitions.push(ComponentDefinition {
                    name: DEFAULT_EXPORT.to_string(),
                    kind: DefinitionKind::ExportDefaultAnonymous,
                    line: offset_line(self.source, decl.span.start),
                    declared_props,
                });
            }
            ExportDefaultDeclarationKind::FunctionExpression(func) => {
                let declared_props =
                    merge_declared_props(&func.params, &self.ts_prop_shapes);
                self.definitions.push(ComponentDefinition {
                    name: DEFAULT_EXPORT.to_string(),
                    kind: DefinitionKind::ExportDefaultAnonymous,
                    line: offset_line(self.source, decl.span.start),
                    declared_props,
                });
            }
            ExportDefaultDeclarationKind::Identifier(ident) => {
                let name = format!("default→{}", ident.name.as_str());
                self.definitions.push(ComponentDefinition {
                    name,
                    kind: DefinitionKind::ExportDefault,
                    line: offset_line(self.source, decl.span.start),
                    declared_props: Vec::new(),
                });
            }
            _ => {}
        }
        walk::walk_export_default_declaration(self, decl);
    }

    fn visit_jsx_element(&mut self, el: &JSXElement<'a>) {
        if let Some("button") = jsx_intrinsic_tag(&el.opening_element.name).as_deref() {
            if !has_spread_attribute(&el.opening_element.attributes)
                && !button_has_accessible_name(&el.opening_element.attributes, &el.children)
            {
                let line = offset_line(self.source, el.opening_element.span.start);
                self.push_a11y(
                    line,
                    Severity::Warning,
                    "a11y-button-name",
                    "`<button>` needs visible text, `aria-label`, `aria-labelledby`, or `title`.",
                );
            }
        }
        walk::walk_jsx_element(self, el);
    }

    fn visit_jsx_opening_element(&mut self, el: &JSXOpeningElement<'a>) {
        self.check_intrinsic_a11y_opening(el);

        let Some(component) = jsx_name(&el.name) else {
            walk::walk_jsx_opening_element(self, el);
            return;
        };
        if usage_is_design_component(&component) {
            let props = props_from_attributes(&el.attributes);
            self.usages.push(JsxUsage {
                component,
                line: offset_line(self.source, el.span.start),
                props,
            });
        }
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
        let (kind, declared_props) = if expr_is_component_like(init) {
            let props = match init {
                Expression::ArrowFunctionExpression(arrow) => {
                    merge_declared_props(&arrow.params, &self.ts_prop_shapes)
                }
                Expression::FunctionExpression(func) => {
                    merge_declared_props(&func.params, &self.ts_prop_shapes)
                }
                _ => Vec::new(),
            };
            let kind = match init {
                Expression::ArrowFunctionExpression(_) => DefinitionKind::ConstArrow,
                Expression::FunctionExpression(_) => DefinitionKind::ConstFunction,
                _ => DefinitionKind::ConstArrow,
            };
            (kind, props)
        } else if expr_is_wrapper_call(init) {
            (DefinitionKind::WrappedComponent, Vec::new())
        } else {
            return;
        };
        self.definitions.push(ComponentDefinition {
            name,
            kind,
            line: offset_line(self.source, decl.span.start),
            declared_props,
        });
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
        assert_eq!(btn.declared_props, vec!["onClick", "size", "variant"]);
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
        assert_eq!(card.declared_props, vec!["body", "title"]);
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
        assert_eq!(btn.declared_props, vec!["onClick", "size", "variant"]);
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
}
