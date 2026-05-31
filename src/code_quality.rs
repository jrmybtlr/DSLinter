//! Code quality heuristics (rule ids `code-*`): patterns that add noise or risk
//! (console/debugger, suppressions, oversized files, inline styles, empty catches, etc.).

use std::path::{Path, PathBuf};

use oxc_ast::ast::{
    CallExpression, DebuggerStatement, Expression, JSXAttribute, JSXAttributeName,
    JSXAttributeValue, JSXChild, JSXFragment, Program, TryStatement,
};
use oxc_ast::visit::walk;
use oxc_ast::Visit;
use crate::lines::{line_of_offset, newline_offsets};
use crate::text_patterns::{suppression_match_iter, todo_marker_match_iter};
use crate::model::{LintFinding, Severity};

const LARGE_FILE_LINES: usize = 400;

fn push_quality_finding(
    out: &mut Vec<LintFinding>,
    path: &Path,
    line: Option<u32>,
    severity: Severity,
    rule_id: &str,
    message: impl Into<String>,
) {
    out.push(LintFinding {
        rule_id: rule_id.to_string(),
        message: message.into(),
        path: path.to_path_buf(),
        line,
        severity,
        variant_label: None,
    });
}

fn console_debug_method<'a>(callee: &'a Expression<'a>) -> Option<&'a str> {
    let Expression::StaticMemberExpression(mem) = callee else {
        return None;
    };
    let Expression::Identifier(obj) = &mem.object else {
        return None;
    };
    if obj.name.as_str() != "console" {
        return None;
    }
    Some(mem.property.name.as_str())
}

/// AST-driven code-quality findings (runs on parsed JS/TS/JSX).
pub fn collect_ast_code_quality(
    report_path: &Path,
    source: &str,
    program: &Program<'_>,
) -> Vec<LintFinding> {
    let newlines = newline_offsets(source);
    let mut v = CodeQualityVisitor {
        report_path: report_path.to_path_buf(),
        newlines: &newlines,
        findings: Vec::new(),
    };
    v.visit_program(program);
    v.findings
}

struct CodeQualityVisitor<'nl> {
    report_path: PathBuf,
    /// Precomputed newline offsets for O(log n) line-number lookup.
    newlines: &'nl [usize],
    findings: Vec<LintFinding>,
}

impl<'nl> CodeQualityVisitor<'nl> {
    fn line(&self, offset: u32) -> u32 {
        line_of_offset(self.newlines, offset as usize)
    }
}

impl<'nl, 'a> Visit<'a> for CodeQualityVisitor<'nl> {
    fn visit_call_expression(&mut self, expr: &CallExpression<'a>) {
        if let Some(method) = console_debug_method(&expr.callee) {
            if method == "error" {
                let line = self.line(expr.span.start);
                push_quality_finding(
                    &mut self.findings,
                    &self.report_path,
                    Some(line),
                    Severity::Info,
                    "code-console-error",
                    "`console.error(...)` left in source — remove or route through logging.",
                );
            } else if matches!(
                method,
                "log" | "debug" | "info" | "warn" | "trace" | "dir" | "table" | "assert"
            ) {
                let line = self.line(expr.span.start);
                push_quality_finding(
                    &mut self.findings,
                    &self.report_path,
                    Some(line),
                    Severity::Info,
                    "code-console",
                    format!(
                        "`console.{method}(...)` left in source — remove before shipping or gate behind dev-only checks."
                    ),
                );
            }
        }
        walk::walk_call_expression(self, expr);
    }

    fn visit_debugger_statement(&mut self, stmt: &DebuggerStatement) {
        let line = self.line(stmt.span.start);
        push_quality_finding(
            &mut self.findings,
            &self.report_path,
            Some(line),
            Severity::Warning,
            "code-debugger",
            "`debugger` statement should not ship to production.",
        );
        walk::walk_debugger_statement(self, stmt);
    }

    fn visit_try_statement(&mut self, stmt: &TryStatement<'a>) {
        if let Some(handler) = &stmt.handler {
            if handler.body.body.is_empty() {
                let line = self.line(handler.span.start);
                push_quality_finding(
                    &mut self.findings,
                    &self.report_path,
                    Some(line),
                    Severity::Info,
                    "code-empty-catch",
                    "Empty `catch` block swallows errors — log, rethrow, or handle intentionally.",
                );
            }
        }
        walk::walk_try_statement(self, stmt);
    }

    fn visit_jsx_attribute(&mut self, attr: &JSXAttribute<'a>) {
        let JSXAttributeName::Identifier(id) = &attr.name else {
            walk::walk_jsx_attribute(self, attr);
            return;
        };
        if id.name.as_str() == "style"
            && matches!(attr.value, Some(JSXAttributeValue::ExpressionContainer(_)))
        {
            let line = self.line(attr.span.start);
            push_quality_finding(
                &mut self.findings,
                &self.report_path,
                Some(line),
                Severity::Info,
                "code-inline-style",
                "Inline `style={{ }}` bypasses design tokens — prefer Tailwind/theme utilities.",
            );
        }
        walk::walk_jsx_attribute(self, attr);
    }

    fn visit_jsx_fragment(&mut self, frag: &JSXFragment<'a>) {
        if frag.children.len() == 1 {
            let single = &frag.children[0];
            let redundant = matches!(
                single,
                JSXChild::Element(_) | JSXChild::Fragment(_) | JSXChild::ExpressionContainer(_)
            );
            if redundant {
                let line = self.line(frag.span.start);
                push_quality_finding(
                    &mut self.findings,
                    &self.report_path,
                    Some(line),
                    Severity::Info,
                    "code-redundant-fragment",
                    "Fragment wraps a single child — often unnecessary with the automatic JSX runtime.",
                );
            }
        }
        walk::walk_jsx_fragment(self, frag);
    }
}

/// Line-oriented code-quality findings (regex / metrics).
pub fn collect_text_code_quality(report_path: &Path, source: &str) -> Vec<LintFinding> {
    let mut out = Vec::new();

    let lines = source.lines().count();
    if lines > LARGE_FILE_LINES {
        push_quality_finding(
            &mut out,
            report_path,
            None,
            Severity::Info,
            "code-large-file",
            format!(
                "File has {lines} lines — consider splitting components, hooks, or utilities for readability."
            ),
        );
    }

    // Precompute newline positions once so the regex loops run in O(log n) per match.
    let newlines = newline_offsets(source);

    for m in suppression_match_iter(source) {
        let line = line_of_offset(&newlines, m.start());
        push_quality_finding(
            &mut out,
            report_path,
            Some(line),
            Severity::Info,
            "code-suppression-comment",
            "Lint or TypeScript suppression comment — ensure it is justified and temporary.",
        );
    }

    for m in todo_marker_match_iter(source) {
        let line = line_of_offset(&newlines, m.start());
        push_quality_finding(
            &mut out,
            report_path,
            Some(line),
            Severity::Info,
            "code-todo-marker",
            "TODO/FIXME/HACK marker — track in your issue system or resolve before release.",
        );
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use oxc_allocator::Allocator;
    use oxc_parser::Parser;
    use oxc_span::SourceType;
    use std::path::PathBuf;

    fn parse<'a>(allocator: &'a Allocator, src: &'a str) -> oxc_ast::ast::Program<'a> {
        let ret = Parser::new(allocator, src, SourceType::tsx()).parse();
        ret.program
    }

    #[test]
    fn code_console() {
        let alloc = Allocator::default();
        let src = "export function X(){ console.log('x'); }";
        let program = parse(&alloc, src);
        let rows = collect_ast_code_quality(&PathBuf::from("x.tsx"), src, &program);
        assert!(rows.iter().any(|s| s.rule_id == "code-console"));
    }

    #[test]
    fn code_console_error_rule() {
        let alloc = Allocator::default();
        let src = "export function X(){ console.error('x'); }";
        let program = parse(&alloc, src);
        let rows = collect_ast_code_quality(&PathBuf::from("x.tsx"), src, &program);
        assert!(rows.iter().any(|s| s.rule_id == "code-console-error"));
    }

    #[test]
    fn code_empty_catch() {
        let alloc = Allocator::default();
        let src = "try { foo(); } catch (e) {}";
        let program = parse(&alloc, src);
        let rows = collect_ast_code_quality(&PathBuf::from("x.tsx"), src, &program);
        assert!(rows.iter().any(|s| s.rule_id == "code-empty-catch"));
    }

    #[test]
    fn text_code_suppression() {
        let src = "// eslint-disable-next-line no-console\nconst x = 1;\n";
        let rows = collect_text_code_quality(&PathBuf::from("x.ts"), src);
        assert!(rows
            .iter()
            .any(|s| s.rule_id == "code-suppression-comment"));
    }
}
