//! Shared report types for scans and governance output.

use std::collections::BTreeMap;
use std::fmt::Display;
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
    /// CVA / static variant option keys per prop (for playground select controls).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub declared_prop_options: BTreeMap<String, Vec<String>>,
    /// Default variant values from CVA `defaultVariants`.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub declared_prop_defaults: BTreeMap<String, String>,
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

impl LintFinding {
    pub fn new(
        rule_id: impl Into<String>,
        path: PathBuf,
        line: Option<u32>,
        severity: Severity,
        message: impl Into<String>,
    ) -> Self {
        Self {
            rule_id: rule_id.into(),
            message: message.into(),
            path,
            line,
            severity,
        }
    }
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

impl FileScan {
    fn with_errors(path: PathBuf, parse_errors: Vec<String>) -> Self {
        Self {
            path,
            definitions: Vec::new(),
            usages: Vec::new(),
            parse_errors,
            findings: Vec::new(),
            ast_extracts: AstExtracts::default(),
        }
    }

    pub fn empty(path: PathBuf) -> Self {
        Self::with_errors(path, Vec::new())
    }

    pub fn read_error(path: PathBuf, err: impl Display) -> Self {
        let msg = format!("dslinter: could not read `{}`: {err}", path.display());
        Self::with_errors(path, vec![msg])
    }

    pub fn unsupported_ext(path: PathBuf, ext: &str) -> Self {
        Self::with_errors(path, vec![format!("dslinter: unsupported extension `{ext}`")])
    }
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

/// Dashboard playground row from scan (all TSX/JSX under the repo when `playground_groups` is unset).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CssTokenCategory {
    Color,
    Spacing,
    Radius,
    Typography,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CssTokenScope {
    Theme,
    Root,
    Selector,
}

#[derive(Debug, Clone, Serialize)]
pub struct CssTokenDefinition {
    pub name: String,
    pub value: String,
    pub category: CssTokenCategory,
    pub scope: CssTokenScope,
    pub path: PathBuf,
    pub line: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct CssTokenUsage {
    pub name: String,
    pub reference_count: u32,
    pub file_count: u32,
    pub files: Vec<PathBuf>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub usage_locations: Vec<UsageLocation>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CssTokenSummary {
    pub definitions: Vec<CssTokenDefinition>,
    pub usage_by_token: Vec<CssTokenUsage>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub unused_tokens: Vec<String>,
}

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
    /// CVA variant option keys per prop (dashboard renders as `<Select>`).
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub declared_prop_options: BTreeMap<String, Vec<String>>,
    /// Default values from CVA `defaultVariants`.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub declared_prop_defaults: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
}

/// Dashboard-relevant slice of `.dslinter.json` embedded in each report.
#[derive(Debug, Clone, Serialize, Default)]
pub struct ReportConfig {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub hidden_components: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub hidden_paths: Vec<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub css_tokens: Option<CssTokenSummary>,
    #[serde(default, skip_serializing_if = "ReportConfig::is_empty")]
    pub config: ReportConfig,
}

impl ReportConfig {
    fn is_empty(&self) -> bool {
        self.hidden_components.is_empty() && self.hidden_paths.is_empty()
    }
}
