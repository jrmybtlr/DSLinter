//! Optional `.dslinter.json` configuration.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use anyhow::Context;
use serde::Deserialize;

const DEFAULT_CONFIG_NAMES: &[&str] = &[".dslinter.json", "dslinter.json"];

#[derive(Debug, Clone, Deserialize, Default)]
pub struct CodeQualityConfig {
    /// Rule ids or prefixes (`code-*` quality heuristics; `smell-*` aliases) to silence for this repo.
    #[serde(default)]
    pub disabled_rules: Vec<String>,
    /// When false, `console.error` calls are not reported (`code-console-error` dropped).
    #[serde(default = "default_true")]
    pub report_console_error: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct DslintConfig {
    /// Restrict component/file discovery to these directory prefixes (relative to repo root).
    /// When empty, all directories are eligible (subject to ignores).
    #[serde(default)]
    pub include_dirs: Vec<String>,
    /// File/directory glob ignores (same semantics as `.gitignore` / `.dslinterignore`).
    /// This is the preferred field name; `exclude_globs` remains supported for compatibility.
    #[serde(default)]
    pub ignore_globs: Vec<String>,
    /// Optional main CSS entry files (relative to repo root) used for token analysis.
    /// When empty, DSLinter discovers CSS files automatically.
    #[serde(default)]
    pub css_entrypoints: Vec<String>,
    /// Component names (exact JSX identifiers) that should not be used.
    #[serde(default)]
    pub deprecated_components: Vec<String>,
    /// Arbitrary token names your design system defines (for adoption metrics).
    #[serde(default)]
    pub known_tokens: Vec<String>,
    /// Playground sidebar groups: group id → path prefixes (longest prefix wins per file).
    #[serde(default)]
    pub playground_groups: HashMap<String, Vec<String>>,
    /// Component names hidden from the dashboard catalog (sidebar, palette, playgrounds).
    /// Scan and governance data are unchanged.
    #[serde(default)]
    pub hidden_components: Vec<String>,
    /// Path prefixes (repo-relative); components defined under these paths are hidden from the catalog.
    #[serde(default)]
    pub hidden_paths: Vec<String>,
    /// Extra glob lines merged with `.gitignore` / `.dslinterignore` semantics.
    #[serde(default)]
    pub exclude_globs: Vec<String>,
    #[serde(default, alias = "smell")]
    pub code_quality: CodeQualityConfig,
    /// When true, emit `unused-prop` findings for declared props with no call-site usage.
    #[serde(default)]
    pub check_unused_props: bool,
    /// When true, emit `a11y-dark-mode-contrast` findings where class tokens imply text/background
    /// colors but no explicit `dark:` color variant is present.
    #[serde(default)]
    pub check_dark_mode_contrast: bool,
    /// When true, emit `token-unused-css-var` for theme/root CSS variables with no references.
    #[serde(default)]
    pub check_unused_css_tokens: bool,
    /// Prefixes for in-repo import paths (e.g. `@/components`). Imports starting with `./`,
    /// `../`, or any of these prefixes are treated as local design-system modules.
    #[serde(default = "default_local_import_prefixes")]
    pub local_import_prefixes: Vec<String>,
    /// Glob patterns for third-party module specifiers excluded from the component catalog
    /// (e.g. `@radix-ui/*`, `lucide-react`). Non-local imports are always excluded; these
    /// patterns document common packages and apply when `local_import_prefixes` is widened.
    #[serde(default = "default_external_import_patterns")]
    pub external_import_patterns: Vec<String>,
    /// Shell command used by the dashboard dev server to open source files.
    /// Supports `{file}`, `{line}`, and `{column}` placeholders (e.g.
    /// `"cursor --goto {file}:{line}:{column}"`).
    #[serde(default)]
    pub editor_open_command: Option<String>,
}

fn default_local_import_prefixes() -> Vec<String> {
    crate::import_filter::default_local_import_prefixes()
}

fn default_external_import_patterns() -> Vec<String> {
    crate::import_filter::default_external_import_patterns()
}

impl DslintConfig {
    /// Load config from the nearest ancestor of `start` that contains `.dslinter.json`.
    /// Returns `(project_root, config)` where `project_root` is the directory holding the file,
    /// or `start` (canonicalized) when no config exists.
    pub fn load_nearest(start: &Path) -> anyhow::Result<(PathBuf, Self)> {
        let mut dir = std::fs::canonicalize(start).unwrap_or_else(|_| start.to_path_buf());
        loop {
            for name in DEFAULT_CONFIG_NAMES {
                let p = dir.join(name);
                if p.is_file() {
                    let raw = std::fs::read_to_string(&p)
                        .with_context(|| format!("read {}", p.display()))?;
                    let config = serde_json::from_str(&raw)
                        .with_context(|| format!("parse {}", p.display()))?;
                    return Ok((dir, config));
                }
            }
            let Some(parent) = dir.parent() else {
                return Ok((dir, Self::default()));
            };
            if parent == dir.as_path() {
                return Ok((dir, Self::default()));
            }
            dir = parent.to_path_buf();
        }
    }

    pub fn load_from_root(root: &Path) -> anyhow::Result<Self> {
        Ok(Self::load_nearest(root)?.1)
    }
}
