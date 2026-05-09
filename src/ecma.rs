//! ECMAScript / TypeScript / JSX parsing via Oxc.

use std::path::Path;

use oxc_allocator::Allocator;
use oxc_ast::ast::{
    BindingPatternKind, ExportDefaultDeclarationKind, Expression, Function, JSXAttributeItem,
    JSXAttributeName, JSXElementName, JSXMemberExpressionObject, VariableDeclarator,
};
use oxc_ast::visit::walk;
use oxc_ast::Visit;
use oxc_parser::{Parser, ParserReturn};
use oxc_span::SourceType;
use oxc_syntax::scope::ScopeFlags;

use crate::model::{ComponentDefinition, DefinitionKind, FileScan, JsxUsage};

const DEFAULT_EXPORT: &str = "default";

pub fn analyze_ecma_file(path: &Path, source: &str) -> FileScan {
    let allocator = Allocator::default();
    let source_type = source_type_for_path(path);
    let ParserReturn {
        program,
        errors,
        panicked,
        ..
    } = Parser::new(&allocator, source, source_type).parse();

    let parse_errors: Vec<String> = errors.iter().map(ToString::to_string).collect();
    if panicked {
        return FileScan {
            path: path.to_path_buf(),
            definitions: Vec::new(),
            usages: Vec::new(),
            parse_errors,
        };
    }

    let mut v = ExtractVisitor {
        source,
        definitions: Vec::new(),
        usages: Vec::new(),
        fn_depth: 0,
    };
    v.visit_program(&program);

    FileScan {
        path: path.to_path_buf(),
        definitions: v.definitions,
        usages: v.usages,
        parse_errors,
    }
}

fn source_type_for_path(path: &Path) -> SourceType {
    SourceType::from_path(path).unwrap_or_else(|_| SourceType::tsx())
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

struct ExtractVisitor<'src> {
    source: &'src str,
    definitions: Vec<ComponentDefinition>,
    usages: Vec<JsxUsage>,
    fn_depth: u32,
}

impl<'a> Visit<'a> for ExtractVisitor<'_> {
    fn visit_function(&mut self, func: &Function<'a>, flags: ScopeFlags) {
        self.fn_depth += 1;
        if self.fn_depth == 1 {
            if let Some(id) = &func.id {
                let name = binding_name(id);
                if is_component_identifier(&name) {
                    self.definitions.push(ComponentDefinition {
                        name,
                        kind: DefinitionKind::Function,
                        line: offset_line(self.source, func.span.start),
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
                    self.definitions.push(ComponentDefinition {
                        name: DEFAULT_EXPORT.to_string(),
                        kind: DefinitionKind::ExportDefaultAnonymous,
                        line: offset_line(self.source, decl.span.start),
                    });
                }
            }
            ExportDefaultDeclarationKind::ArrowFunctionExpression(_)
            | ExportDefaultDeclarationKind::FunctionExpression(_) => {
                self.definitions.push(ComponentDefinition {
                    name: DEFAULT_EXPORT.to_string(),
                    kind: DefinitionKind::ExportDefaultAnonymous,
                    line: offset_line(self.source, decl.span.start),
                });
            }
            ExportDefaultDeclarationKind::Identifier(ident) => {
                let name = format!("default→{}", ident.name.as_str());
                self.definitions.push(ComponentDefinition {
                    name,
                    kind: DefinitionKind::ExportDefault,
                    line: offset_line(self.source, decl.span.start),
                });
            }
            _ => {}
        }
        walk::walk_export_default_declaration(self, decl);
    }

    fn visit_jsx_opening_element(&mut self, el: &oxc_ast::ast::JSXOpeningElement<'a>) {
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
        let kind = if expr_is_component_like(init) {
            match init {
                Expression::ArrowFunctionExpression(_) => DefinitionKind::ConstArrow,
                Expression::FunctionExpression(_) => DefinitionKind::ConstFunction,
                _ => DefinitionKind::ConstArrow,
            }
        } else if expr_is_wrapper_call(init) {
            DefinitionKind::WrappedComponent
        } else {
            return;
        };
        self.definitions.push(ComponentDefinition {
            name,
            kind,
            line: offset_line(self.source, decl.span.start),
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
}
