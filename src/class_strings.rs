//! AST extraction for class strings, `cn`/`clsx` arguments, and string literals (Oxc).

use std::sync::OnceLock;

use oxc_ast::ast::{
    Argument, CallExpression, Expression, JSXAttribute, JSXAttributeName, JSXAttributeValue, Program,
    TemplateElementValue,
};
use oxc_ast::visit::walk;
use oxc_ast::Visit;
use regex::Regex;

use crate::lines::line_of_offset;
use crate::model::{AstExtracts, ClassStringFragment, ClassStringKind, StringLiteralFragment};

fn class_attr_template_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r#"(?:class|className)\s*=\s*["']([^"']+)["']"#).expect("class attr regex")
    })
}

/// Collect class-string and literal fragments from a parsed ECMA program.
pub fn collect_ast_extracts(
    source: &str,
    program: &Program<'_>,
) -> AstExtracts {
    let newlines = crate::lines::newline_offsets(source);
    let mut v = ExtractVisitor {
        newlines: &newlines,
        extracts: AstExtracts::default(),
    };
    v.visit_program(program);
    v.extracts
}

/// Heuristic class strings from Vue (or other) template markup (not Oxc-parsed).
pub fn extend_template_class_extracts(
    extracts: &mut AstExtracts,
    template: &str,
    line_offset: u32,
) {
    let newlines = crate::lines::newline_offsets(template);
    let re = class_attr_template_re();
    for caps in re.captures_iter(template) {
        let Some(full) = caps.get(0) else {
            continue;
        };
        let classes = caps.get(1).map(|m| m.as_str()).unwrap_or("").to_string();
        if classes.is_empty() {
            continue;
        }
        let line = line_offset + line_of_offset(&newlines, full.start());
        extracts.class_strings.push(ClassStringFragment {
            line,
            text: classes,
            kind: ClassStringKind::VueTemplate,
        });
    }
}

struct ExtractVisitor<'nl> {
    newlines: &'nl [usize],
    extracts: AstExtracts,
}

impl<'nl> ExtractVisitor<'nl> {
    fn line(&self, offset: u32) -> u32 {
        line_of_offset(self.newlines, offset as usize)
    }

    fn push_class(&mut self, line: u32, text: String, kind: ClassStringKind) {
        if text.is_empty() {
            return;
        }
        self.extracts.class_strings.push(ClassStringFragment {
            line,
            text,
            kind,
        });
    }

    fn push_literal(&mut self, line: u32, value: String) {
        if value.is_empty() {
            return;
        }
        self.extracts
            .string_literals
            .push(StringLiteralFragment { line, value });
    }

    fn extract_class_helper_args(&mut self, line: u32, args: &[Argument<'_>]) {
        for arg in args {
            match &arg.value {
                Expression::StringLiteral(lit) => {
                    self.push_class(line, lit.value.to_string(), ClassStringKind::ClassHelper);
                }
                Expression::TemplateLiteral(tpl) => {
                    for quasi in &tpl.quasis {
                        let TemplateElementValue::String(s) = &quasi.value.raw else {
                            continue;
                        };
                        self.push_class(line, s.to_string(), ClassStringKind::ClassHelper);
                    }
                }
                _ => {}
            }
        }
    }
}

fn is_class_helper_name(name: &str) -> bool {
    matches!(name, "cn" | "clsx" | "classnames")
}

impl<'a> Visit<'a> for ExtractVisitor<'_> {
    fn visit_string_literal(&mut self, lit: &oxc_ast::ast::StringLiteral<'a>) {
        let line = self.line(lit.span.start);
        self.push_literal(line, lit.value.to_string());
        walk::walk_string_literal(self, lit);
    }

    fn visit_call_expression(&mut self, expr: &CallExpression<'a>) {
        if let Expression::Identifier(id) = &expr.callee {
            if is_class_helper_name(id.name.as_str()) {
                let line = self.line(expr.span.start);
                self.extract_class_helper_args(line, &expr.arguments);
            }
        }
        walk::walk_call_expression(self, expr);
    }

    fn visit_jsx_attribute(&mut self, attr: &JSXAttribute<'a>) {
        let JSXAttributeName::Identifier(id) = &attr.name else {
            walk::walk_jsx_attribute(self, attr);
            return;
        };
        let name = id.name.as_str();
        if name != "class" && name != "className" {
            walk::walk_jsx_attribute(self, attr);
            return;
        }
        let line = self.line(attr.span.start);
        match &attr.value {
            Some(JSXAttributeValue::StringLiteral(lit)) => {
                self.push_class(line, lit.value.to_string(), ClassStringKind::JsxAttr);
            }
            Some(JSXAttributeValue::ExpressionContainer(container)) => {
                if let Expression::CallExpression(call) = &container.expression {
                    if let Expression::Identifier(callee) = &call.callee {
                        if is_class_helper_name(callee.name.as_str()) {
                            self.extract_class_helper_args(line, &call.arguments);
                        }
                    }
                }
            }
            _ => {}
        }
        walk::walk_jsx_attribute(self, attr);
    }
}

/// Shift line numbers when merging a script block into a Vue SFC scan.
pub fn offset_ast_extracts(extracts: &mut AstExtracts, line_offset: u32) {
    if line_offset == 0 {
        return;
    }
    for c in &mut extracts.class_strings {
        c.line += line_offset;
    }
    for s in &mut extracts.string_literals {
        s.line += line_offset;
    }
}

impl AstExtracts {
    pub fn is_empty(&self) -> bool {
        self.class_strings.is_empty() && self.string_literals.is_empty()
    }

    pub fn merge_from(&mut self, mut other: AstExtracts) {
        self.class_strings.append(&mut other.class_strings);
        self.string_literals.append(&mut other.string_literals);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use oxc_allocator::Allocator;
    use oxc_parser::Parser;
    use oxc_span::SourceType;
    fn parse_extract(src: &str) -> AstExtracts {
        let allocator = Allocator::default();
        let ret = Parser::new(&allocator, src, SourceType::tsx()).parse();
        collect_ast_extracts(src, &ret.program)
    }

    #[test]
    fn hex_in_string_literal_not_in_comment() {
        let src = r#"
// #ffffff in comment should not count
const c = "#ff00aa";
export function X() { return null; }
"#;
        let ex = parse_extract(src);
        assert!(
            ex.string_literals
                .iter()
                .any(|s| s.value.contains("#ff00aa")),
            "expected literal with hex"
        );
    }

    #[test]
    fn jsx_class_and_cn_extracted() {
        let src = r#"
export function Btn() {
  return <button className="text-red-500 bg-white" />;
}
export function Cn() {
  return <div className={cn("p-2", "dark:text-white")} />;
}
"#;
        let ex = parse_extract(src);
        assert!(
            ex.class_strings
                .iter()
                .any(|c| c.text.contains("text-red-500")),
            "jsx attr"
        );
        assert!(
            ex.class_strings
                .iter()
                .any(|c| c.text.contains("dark:text-white")),
            "cn arg"
        );
    }
}
