//! Shared report types for scans and governance output.

use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::Serialize;

/// How a UI component binding was discovered in source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DefinitionKind {
    Function,
    Class,
    ConstArrow,
    ConstFunction,
    WrappedComponent,
    ExportDefault,
    ExportDefaultAnonymous,
}

#[derive(Debug, Clone, Serialize)]
pub struct ComponentDefinition {
    pub name: String,
    pub kind: DefinitionKind,
    pub line: u32,
    /// Props destructured from the first parameter of this component function, if detectable.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub declared_props: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct JsxUsage {
    /// Fully-qualified JSX name, e.g. `Card` or `Stack.Item`.
    pub component: String,
    pub line: u32,
    /// Prop names passed at this call site.
    pub props: Vec<String>,
    /// Statically-known literal prop values (e.g. `size="sm"`, `disabled`, `rows={3}`).
    ///
    /// Non-literal expressions are intentionally omitted.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub prop_values: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LintFinding {
    pub rule_id: String,
    pub message: String,
    pub path: PathBuf,
    pub line: Option<u32>,
    pub severity: Severity,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Error,
    Warning,
    Info,
}

/// Source of a extracted Tailwind/class string.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ClassStringKind {
    JsxAttr,
    ClassHelper,
    VueTemplate,
}

#[derive(Debug, Clone, Serialize)]
pub struct ClassStringFragment {
    pub line: u32,
    pub text: String,
    pub kind: ClassStringKind,
}

#[derive(Debug, Clone, Serialize)]
pub struct StringLiteralFragment {
    pub line: u32,
    pub value: String,
}

/// AST-derived fragments for token/class rules (not emitted in JSON reports).
#[derive(Debug, Clone, Default)]
pub struct AstExtracts {
    pub class_strings: Vec<ClassStringFragment>,
    pub string_literals: Vec<StringLiteralFragment>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileScan {
    pub path: PathBuf,
    pub definitions: Vec<ComponentDefinition>,
    pub usages: Vec<JsxUsage>,
    pub parse_errors: Vec<String>,
    /// Rule violations detected in this file (e.g. accessibility).
    #[serde(default)]
    pub findings: Vec<LintFinding>,
    /// Class strings and literals from Oxc (and Vue template heuristics); workspace rules only.
    #[serde(skip)]
    pub ast_extracts: AstExtracts,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct GovernanceScores {
    /// Overall composite (0–100).
    pub design_system_health: u8,
    pub ux_consistency: u8,
    pub accessibility: u8,
    pub maintainability: u8,
}

#[derive(Debug, Clone, Serialize)]
pub struct DuplicateComponent {
    pub name: String,
    pub locations: Vec<PathBuf>,
}

/// One call-site where a component is referenced.
#[derive(Debug, Clone, Serialize)]
pub struct UsageLocation {
    pub path: PathBuf,
    pub line: u32,
    /// Props passed at this particular call site.
    pub props: Vec<String>,
    /// Statically-known literal prop values at this call site.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub prop_values: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UsageSummary {
    pub component: String,
    pub reference_count: u32,
    pub file_count: usize,
    /// Largest number of props observed on a single reference (variant / API surface signal).
    pub max_props_on_single_use: usize,
    pub files: Vec<PathBuf>,
    /// How many call-sites pass each named prop (sorted key for deterministic JSON output).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub prop_frequencies: BTreeMap<String, u32>,
    /// How many call-sites pass each literal value for each prop.
    ///
    /// Example: `size` → { "sm": 12, "md": 3 }
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub prop_value_frequencies: BTreeMap<String, BTreeMap<String, u32>>,
    /// Every individual call-site with its file, line, and passed props.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub usage_locations: Vec<UsageLocation>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OwnershipSummary {
    pub owner: String,
    pub files: usize,
    pub definitions: usize,
}

/// Workbench playground row derived from scan + `playground_groups` in config (no per-file TS).
#[derive(Debug, Clone, Serialize)]
pub struct PlaygroundSpec {
    /// Stable id (file stem), used in URLs / sidebar.
    pub id: String,
    /// Named export to render (`Card` when file stem is `DuplicateCardA`, etc.).
    pub export_name: String,
    /// Path relative to workspace root, slash-separated.
    pub rel_path: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub declared_props: Vec<String>,
    /// Simplified TS kinds per prop (`boolean` \| `string` \| `number` \| `unknown`), when tooling fills them.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub declared_prop_kinds: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceReport {
    pub root: PathBuf,
    pub files: Vec<FileScan>,
    pub findings: Vec<LintFinding>,
    pub duplicate_components: Vec<DuplicateComponent>,
    pub usage_by_component: Vec<UsageSummary>,
    pub ownership: Vec<OwnershipSummary>,
    pub scores: GovernanceScores,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub playgrounds: Vec<PlaygroundSpec>,
}
