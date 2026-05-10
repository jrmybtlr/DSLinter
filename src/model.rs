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
    pub props: Vec<String>,
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

#[derive(Debug, Clone, Serialize)]
pub struct FileScan {
    pub path: PathBuf,
    pub definitions: Vec<ComponentDefinition>,
    pub usages: Vec<JsxUsage>,
    pub parse_errors: Vec<String>,
    /// Rule violations detected in this file (e.g. accessibility).
    #[serde(default)]
    pub findings: Vec<LintFinding>,
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

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceReport {
    pub root: PathBuf,
    pub files: Vec<FileScan>,
    pub findings: Vec<LintFinding>,
    pub duplicate_components: Vec<DuplicateComponent>,
    pub usage_by_component: Vec<UsageSummary>,
    pub ownership: Vec<OwnershipSummary>,
    pub scores: GovernanceScores,
}
