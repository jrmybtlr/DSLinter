//! Code smell heuristics for sloppy or redundant patterns (console noise,
//! suppressions, oversized files, inline styles, empty catches, etc.).

use std::path::{Path, PathBuf};

use oxc_ast::ast::{
    CallExpression, DebuggerStatement, Expression, JSXAttribute, JSXAttributeName,
    JSXAttributeValue, JSXChild, JSXFragment, Program, TryStatement,
};
use oxc_ast::visit::walk;
use oxc_ast::Visit;
use regex::Regex;

use crate::model::{LintFinding, Severity};

const LARGE_FILE_LINES: usize = 400;

fn offset_line(source: &str, offset: u32) -> u32 {
    let offset = offset as usize;
    if offset >= source.len() {
        return source.lines().count().max(1) as u32;
    }
    1 + source[..offset].bytes().filter(|&b| b == b'\n').count() as u32
}

fn push_smell(
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

/// AST-driven smells (runs on parsed JS/TS/JSX).
pub fn collect_ast_smells(
    report_path: &Path,
    source: &str,
    program: &Program<'_>,
) -> Vec<LintFinding> {
    let mut v = SmellVisitor {
        report_path: report_path.to_path_buf(),
        source,
        findings: Vec::new(),
    };
    v.visit_program(program);
    v.findings
}

struct SmellVisitor<'src> {
    report_path: PathBuf,
    source: &'src str,
    findings: Vec<LintFinding>,
}

impl<'src, 'a> Visit<'a> for SmellVisitor<'src> {
    fn visit_call_expression(&mut self, expr: &CallExpression<'a>) {
        if let Some(method) = console_debug_method(&expr.callee) {
            if method == "error" {
                let line = offset_line(self.source, expr.span.start);
                push_smell(
                    &mut self.findings,
                    &self.report_path,
                    Some(line),
                    Severity::Info,
                    "smell-console-error",
                    "`console.error(...)` left in source — remove or route through logging.",
                );
            } else if matches!(
                method,
                "log" | "debug" | "info" | "warn" | "trace" | "dir" | "table" | "assert"
            ) {
                let line = offset_line(self.source, expr.span.start);
                push_smell(
                    &mut self.findings,
                    &self.report_path,
                    Some(line),
                    Severity::Info,
                    "smell-console",
                    format!(
                        "`console.{method}(...)` left in source — remove before shipping or gate behind dev-only checks."
                    ),
                );
            }
        }
        walk::walk_call_expression(self, expr);
    }

    fn visit_debugger_statement(&mut self, stmt: &DebuggerStatement) {
        let line = offset_line(self.source, stmt.span.start);
        push_smell(
            &mut self.findings,
            &self.report_path,
            Some(line),
            Severity::Warning,
            "smell-debugger",
            "`debugger` statement should not ship to production.",
        );
        walk::walk_debugger_statement(self, stmt);
    }

    fn visit_try_statement(&mut self, stmt: &TryStatement<'a>) {
        if let Some(handler) = &stmt.handler {
            if handler.body.body.is_empty() {
                let line = offset_line(self.source, handler.span.start);
                push_smell(
                    &mut self.findings,
                    &self.report_path,
                    Some(line),
                    Severity::Info,
                    "smell-empty-catch",
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
            let line = offset_line(self.source, attr.span.start);
            push_smell(
                &mut self.findings,
                &self.report_path,
                Some(line),
                Severity::Info,
                "smell-inline-style",
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
                let line = offset_line(self.source, frag.span.start);
                push_smell(
                    &mut self.findings,
                    &self.report_path,
                    Some(line),
                    Severity::Info,
                    "smell-redundant-fragment",
                    "Fragment wraps a single child — often unnecessary with the automatic JSX runtime.",
                );
            }
        }
        walk::walk_jsx_fragment(self, frag);
    }
}

/// Line-oriented smells (regex / metrics).
pub fn collect_text_smells(report_path: &Path, source: &str) -> Vec<LintFinding> {
    let mut out = Vec::new();

    let lines = source.lines().count();
    if lines > LARGE_FILE_LINES {
        push_smell(
            &mut out,
            report_path,
            None,
            Severity::Info,
            "smell-large-file",
            format!(
                "File has {lines} lines — consider splitting components, hooks, or utilities for readability."
            ),
        );
    }

    let suppression =
        Regex::new(r"(?m)//.*\beslint-disable\b|@ts-ignore\b|@ts-expect-error\b|@ts-nocheck\b")
            .expect("suppression regex");
    for m in suppression.find_iter(source) {
        let line = offset_line(source, m.start() as u32);
        push_smell(
            &mut out,
            report_path,
            Some(line),
            Severity::Info,
            "smell-suppression-comment",
            "Lint or TypeScript suppression comment — ensure it is justified and temporary.",
        );
    }

    let todo =
        Regex::new(r"(?m)//\s*(TODO|FIXME|HACK)\b|/\*\s*(TODO|FIXME|HACK)\b").expect("todo regex");
    for m in todo.find_iter(source) {
        let line = offset_line(source, m.start() as u32);
        push_smell(
            &mut out,
            report_path,
            Some(line),
            Severity::Info,
            "smell-todo-marker",
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
    fn smell_console() {
        let alloc = Allocator::default();
        let src = "export function X(){ console.log('x'); }";
        let program = parse(&alloc, src);
        let smells = collect_ast_smells(&PathBuf::from("x.tsx"), src, &program);
        assert!(smells.iter().any(|s| s.rule_id == "smell-console"));
    }

    #[test]
    fn smell_console_error_rule() {
        let alloc = Allocator::default();
        let src = "export function X(){ console.error('x'); }";
        let program = parse(&alloc, src);
        let smells = collect_ast_smells(&PathBuf::from("x.tsx"), src, &program);
        assert!(smells.iter().any(|s| s.rule_id == "smell-console-error"));
    }

    #[test]
    fn smell_empty_catch() {
        let alloc = Allocator::default();
        let src = "try { foo(); } catch (e) {}";
        let program = parse(&alloc, src);
        let smells = collect_ast_smells(&PathBuf::from("x.tsx"), src, &program);
        assert!(smells.iter().any(|s| s.rule_id == "smell-empty-catch"));
    }

    #[test]
    fn text_smell_suppression() {
        let src = "// eslint-disable-next-line no-console\nconst x = 1;\n";
        let smells = collect_text_smells(&PathBuf::from("x.ts"), src);
        assert!(smells
            .iter()
            .any(|s| s.rule_id == "smell-suppression-comment"));
    }
}
