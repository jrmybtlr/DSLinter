//! Capture sanitized JSX example subtrees from real call sites.
//!
//! The dashboard replays these trees with `createElement` to auto-render
//! compound components (Breadcrumb, Pagination, …) without hand-written
//! playground stories. Dynamic code is sanitized at capture time:
//!
//! - `.map()` callbacks are unrolled [`MAP_UNROLL_COUNT`] times
//! - ternaries pick the alternate branch on all but the last unrolled
//!   iteration (so `isLast ? <Page/> : <Link/>` shows both variants)
//! - `cond && <X/>` is skipped on the last unrolled iteration (trailing
//!   separators) and kept otherwise
//! - other `{expr}` children become [`ExampleNode::Placeholder`] hints
//! - only literal props are kept; spreads, `key`/`ref`, and function props
//!   are dropped

use std::collections::{BTreeMap, HashSet};

use oxc_ast::ast::{
    Argument, Expression, JSXAttributeItem, JSXAttributeName, JSXAttributeValue, JSXChild,
    JSXElement, JSXFragment, LogicalOperator, Statement,
};

use crate::ecma::jsx_name;
use crate::model::{ExampleNode, ExampleValue};

/// Iterations when unrolling `.map()` callbacks.
const MAP_UNROLL_COUNT: usize = 3;
/// Total node budget per captured tree.
const MAX_NODES: usize = 80;
/// Maximum element nesting depth.
const MAX_DEPTH: usize = 12;

struct Capture {
    nodes_left: usize,
}

impl Capture {
    fn take_node(&mut self) -> bool {
        if self.nodes_left == 0 {
            return false;
        }
        self.nodes_left -= 1;
        true
    }
}

/// Loop-position context for conditional sanitization.
#[derive(Clone, Copy)]
struct IterCtx {
    in_unrolled_map: bool,
    is_last_iteration: bool,
}

impl IterCtx {
    const ROOT: Self = Self {
        in_unrolled_map: false,
        is_last_iteration: false,
    };
}

/// True when the element composes further JSX (worth capturing an example tree).
pub fn element_has_composition_children(children: &[JSXChild<'_>]) -> bool {
    children.iter().any(|child| {
        matches!(
            child,
            JSXChild::Element(_) | JSXChild::Fragment(_) | JSXChild::ExpressionContainer(_)
        )
    })
}

/// Serialize a JSX element into a data-only [`ExampleNode`] tree.
pub fn example_tree_from_jsx_element(el: &JSXElement<'_>) -> Option<ExampleNode> {
    let mut cap = Capture {
        nodes_left: MAX_NODES,
    };
    element_node(el, &mut cap, IterCtx::ROOT, 0)
}

/// `(component_element_count, distinct_component_names)` among descendants
/// of `tree` (the root itself is excluded).
pub fn descendant_component_stats(tree: &ExampleNode) -> (usize, usize) {
    let mut distinct: HashSet<&str> = HashSet::new();
    let mut count = 0usize;
    if let ExampleNode::Element { children, .. } = tree {
        for child in children {
            count_component_elements(child, &mut count, &mut distinct);
        }
    }
    (count, distinct.len())
}

/// Total node count of `tree` (elements, text, and placeholders).
pub fn tree_node_count(tree: &ExampleNode) -> usize {
    match tree {
        ExampleNode::Element { children, .. } => {
            1 + children.iter().map(tree_node_count).sum::<usize>()
        }
        ExampleNode::Text { .. } | ExampleNode::Placeholder { .. } => 1,
    }
}

fn count_component_elements<'t>(
    node: &'t ExampleNode,
    count: &mut usize,
    distinct: &mut HashSet<&'t str>,
) {
    if let ExampleNode::Element { name, children, .. } = node {
        if name_is_component(name) {
            *count += 1;
            distinct.insert(name.as_str());
        }
        for child in children {
            count_component_elements(child, count, distinct);
        }
    }
}

fn name_is_component(name: &str) -> bool {
    name.chars().next().is_some_and(|c| c.is_ascii_uppercase())
}

fn is_fragment_name(name: &str) -> bool {
    name == "Fragment" || name.ends_with(".Fragment")
}

fn element_node(
    el: &JSXElement<'_>,
    cap: &mut Capture,
    ctx: IterCtx,
    depth: usize,
) -> Option<ExampleNode> {
    if depth > MAX_DEPTH || !cap.take_node() {
        return None;
    }
    let name = jsx_name(&el.opening_element.name)?;
    let props = example_props(&el.opening_element.attributes);
    let children = children_nodes(&el.children, cap, ctx, depth + 1);
    Some(ExampleNode::Element {
        name,
        props,
        children,
    })
}

fn push_text(out: &mut Vec<ExampleNode>, cap: &mut Capture, raw: &str) {
    let collapsed = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() || !cap.take_node() {
        return;
    }
    out.push(ExampleNode::Text { value: collapsed });
}

fn push_placeholder(out: &mut Vec<ExampleNode>, cap: &mut Capture, hint: String) {
    if !cap.take_node() {
        return;
    }
    out.push(ExampleNode::Placeholder { hint });
}

fn splice_fragment(
    out: &mut Vec<ExampleNode>,
    frag: &JSXFragment<'_>,
    cap: &mut Capture,
    ctx: IterCtx,
    depth: usize,
) {
    out.extend(children_nodes(&frag.children, cap, ctx, depth));
}

fn children_nodes(
    children: &[JSXChild<'_>],
    cap: &mut Capture,
    ctx: IterCtx,
    depth: usize,
) -> Vec<ExampleNode> {
    let mut out = Vec::new();
    if depth > MAX_DEPTH {
        return out;
    }
    for child in children {
        if cap.nodes_left == 0 {
            break;
        }
        match child {
            JSXChild::Text(t) => push_text(&mut out, cap, &t.value),
            JSXChild::Element(el) => push_child_element(&mut out, el, cap, ctx, depth),
            JSXChild::Fragment(frag) => splice_fragment(&mut out, frag, cap, ctx, depth),
            JSXChild::ExpressionContainer(container) => {
                if let Some(expr) = container.expression.as_expression() {
                    nodes_from_expression(&mut out, expr, cap, ctx, depth);
                }
            }
            JSXChild::Spread(_) => {}
        }
    }
    out
}

fn push_child_element(
    out: &mut Vec<ExampleNode>,
    el: &JSXElement<'_>,
    cap: &mut Capture,
    ctx: IterCtx,
    depth: usize,
) {
    // `<Fragment key={…}>` wrappers are spliced away like `<>…</>`.
    if jsx_name(&el.opening_element.name).is_some_and(|n| is_fragment_name(&n)) {
        out.extend(children_nodes(&el.children, cap, ctx, depth));
        return;
    }
    if let Some(node) = element_node(el, cap, ctx, depth) {
        out.push(node);
    }
}

fn unwrap_parens<'a>(expr: &'a Expression<'a>) -> &'a Expression<'a> {
    let mut cur = expr;
    while let Expression::ParenthesizedExpression(paren) = cur {
        cur = &paren.expression;
    }
    cur
}

fn nodes_from_expression(
    out: &mut Vec<ExampleNode>,
    expr: &Expression<'_>,
    cap: &mut Capture,
    ctx: IterCtx,
    depth: usize,
) {
    if depth > MAX_DEPTH || cap.nodes_left == 0 {
        return;
    }
    let expr = unwrap_parens(expr);
    match expr {
        Expression::StringLiteral(s) => push_text(out, cap, s.value.as_str()),
        Expression::NumericLiteral(n) => push_text(out, cap, &n.value.to_string()),
        Expression::TemplateLiteral(tpl) if tpl.expressions.is_empty() => {
            let cooked = tpl
                .quasis
                .iter()
                .map(|q| q.value.cooked.as_deref().unwrap_or(""))
                .collect::<Vec<_>>()
                .join("");
            push_text(out, cap, &cooked);
        }
        Expression::BooleanLiteral(_) | Expression::NullLiteral(_) => {}
        Expression::JSXElement(el) => push_child_element(out, el, cap, ctx, depth),
        Expression::JSXFragment(frag) => splice_fragment(out, frag, cap, ctx, depth),
        Expression::ConditionalExpression(cond) => {
            // In an unrolled map, keep the alternate branch until the last
            // iteration so `isLast ? <Page/> : <Link/>` shows both variants.
            let branch = if ctx.in_unrolled_map && !ctx.is_last_iteration {
                &cond.alternate
            } else {
                &cond.consequent
            };
            nodes_from_expression(out, branch, cap, ctx, depth);
        }
        Expression::LogicalExpression(logic) if logic.operator == LogicalOperator::And => {
            // `!isLast && <Separator/>` idiom: drop on the last unrolled iteration.
            if !(ctx.in_unrolled_map && ctx.is_last_iteration) {
                nodes_from_expression(out, &logic.right, cap, ctx, depth);
            }
        }
        Expression::CallExpression(_) => {
            if let Some(body) = map_call_body(expr) {
                for i in 0..MAP_UNROLL_COUNT {
                    let iter_ctx = IterCtx {
                        in_unrolled_map: true,
                        is_last_iteration: i == MAP_UNROLL_COUNT - 1,
                    };
                    nodes_from_expression(out, body, cap, iter_ctx, depth);
                }
            } else {
                push_placeholder(out, cap, hint_from_expression(expr));
            }
        }
        other => push_placeholder(out, cap, hint_from_expression(other)),
    }
}

/// Returned expression of `items.map((item) => …)` callbacks.
fn map_call_body<'a>(expr: &'a Expression<'a>) -> Option<&'a Expression<'a>> {
    let Expression::CallExpression(call) = expr else {
        return None;
    };
    let Expression::StaticMemberExpression(member) = &call.callee else {
        return None;
    };
    if member.property.name.as_str() != "map" {
        return None;
    }
    returned_expression(call.arguments.first()?)
}

fn returned_expression<'a>(arg: &'a Argument<'a>) -> Option<&'a Expression<'a>> {
    let body = match arg {
        Argument::ArrowFunctionExpression(arrow) => {
            if arrow.expression {
                if let Some(Statement::ExpressionStatement(stmt)) = arrow.body.statements.first() {
                    return Some(&stmt.expression);
                }
                return None;
            }
            &arrow.body
        }
        Argument::FunctionExpression(func) => func.body.as_ref()?,
        _ => return None,
    };
    for stmt in &body.statements {
        if let Statement::ReturnStatement(ret) = stmt {
            return ret.argument.as_ref();
        }
    }
    None
}

fn capitalize_first(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

fn hint_from_expression(expr: &Expression<'_>) -> String {
    match unwrap_parens(expr) {
        Expression::Identifier(id) => capitalize_first(id.name.as_str()),
        Expression::StaticMemberExpression(member) => {
            capitalize_first(member.property.name.as_str())
        }
        Expression::ComputedMemberExpression(member) => hint_from_expression(&member.object),
        Expression::CallExpression(call) => hint_from_expression(&call.callee),
        _ => "Example".to_string(),
    }
}

fn example_props(items: &[JSXAttributeItem<'_>]) -> BTreeMap<String, ExampleValue> {
    let mut out = BTreeMap::new();
    for item in items {
        let JSXAttributeItem::Attribute(attr) = item else {
            continue;
        };
        let JSXAttributeName::Identifier(id) = &attr.name else {
            continue;
        };
        let key = id.name.as_str();
        if key == "key" || key == "ref" {
            continue;
        }
        let Some(value) = example_value_from_attr(&attr.value) else {
            continue;
        };
        out.entry(key.to_string()).or_insert(value);
    }
    out
}

fn is_class_helper_name(name: &str) -> bool {
    matches!(name, "cn" | "clsx" | "classnames")
}

fn static_class_literals_from_call_args(args: &[Argument<'_>]) -> Vec<String> {
    let mut out = Vec::new();
    for arg in args {
        match arg {
            Argument::StringLiteral(s) => out.push(s.value.to_string()),
            Argument::TemplateLiteral(tpl) if tpl.expressions.is_empty() => {
                let cooked = tpl
                    .quasis
                    .iter()
                    .map(|q| q.value.cooked.as_deref().unwrap_or(""))
                    .collect::<Vec<_>>()
                    .join("");
                if !cooked.is_empty() {
                    out.push(cooked);
                }
            }
            _ => {}
        }
    }
    out
}

fn class_name_from_class_helper_call(call: &oxc_ast::ast::CallExpression<'_>) -> Option<String> {
    let Expression::Identifier(id) = &call.callee else {
        return None;
    };
    if !is_class_helper_name(id.name.as_str()) {
        return None;
    }
    let parts = static_class_literals_from_call_args(&call.arguments);
    if parts.is_empty() {
        return None;
    }
    Some(parts.join(" "))
}

fn example_value_from_attr(value: &Option<JSXAttributeValue<'_>>) -> Option<ExampleValue> {
    match value {
        None => Some(ExampleValue::Bool(true)), // boolean shorthand: <Comp disabled />
        Some(JSXAttributeValue::StringLiteral(s)) => {
            Some(ExampleValue::String(s.value.to_string()))
        }
        Some(JSXAttributeValue::ExpressionContainer(container)) => {
            let inner = container.expression.as_expression()?;
            let inner = unwrap_parens(inner);
            if let Expression::CallExpression(call) = inner {
                if let Some(class_name) = class_name_from_class_helper_call(call) {
                    return Some(ExampleValue::String(class_name));
                }
            }
            match inner {
                Expression::StringLiteral(s) => Some(ExampleValue::String(s.value.to_string())),
                Expression::NumericLiteral(n) => Some(ExampleValue::Number(n.value)),
                Expression::BooleanLiteral(b) => Some(ExampleValue::Bool(b.value)),
                Expression::TemplateLiteral(tpl) if tpl.expressions.is_empty() => {
                    let cooked = tpl
                        .quasis
                        .iter()
                        .map(|q| q.value.cooked.as_deref().unwrap_or(""))
                        .collect::<Vec<_>>()
                        .join("");
                    Some(ExampleValue::String(cooked))
                }
                _ => None,
            }
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ecma::analyze_ecma_file;
    use std::path::PathBuf;

    #[test]
    fn example_tree_keeps_cn_static_class_literals() {
        let src = r#"
export function Page() {
  return (
    <Chip className={cn('flex items-center px-3', 'ml-1.5 text-sm')}>
      <span>Label</span>
    </Chip>
  );
}
"#;
        let scan = analyze_ecma_file(&PathBuf::from("Page.tsx"), src);
        let usage = scan
            .usages
            .iter()
            .find(|u| u.component == "Chip")
            .expect("Chip usage");
        let tree = usage.example_tree.as_ref().expect("tree");
        let ExampleNode::Element { props, .. } = tree else {
            panic!("expected element");
        };
        assert_eq!(
            props.get("className"),
            Some(&ExampleValue::String(
                "flex items-center px-3 ml-1.5 text-sm".into()
            ))
        );
    }
}
