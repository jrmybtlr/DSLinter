//! Optional `.dslint.json` configuration.

use std::collections::HashMap;
use std::path::Path;

use anyhow::Context;
use serde::Deserialize;

const DEFAULT_CONFIG_NAMES: &[&str] = &[".dslint.json", "dslint.json"];

#[derive(Debug, Clone, Deserialize, Default)]
pub struct SmellConfig {
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
    /// File/directory glob ignores (same semantics as `.gitignore` / `.dslintignore`).
    /// This is the preferred field name; `exclude_globs` remains supported for compatibility.
    #[serde(default)]
    pub ignore_globs: Vec<String>,
    /// Optional main CSS entry files (relative to repo root) used for token analysis.
    /// When empty, DSLint discovers CSS files automatically.
    #[serde(default)]
    pub css_entrypoints: Vec<String>,
    /// Component names (exact JSX identifiers) that should not be used.
    #[serde(default)]
    pub deprecated_components: Vec<String>,
    /// Arbitrary token names your design system defines (for adoption metrics).
    #[serde(default)]
    pub known_tokens: Vec<String>,
    /// Map of owner label → path prefixes (slash-normalized, relative to repo root).
    #[serde(default)]
    pub ownership: HashMap<String, Vec<String>>,
    /// Playground sidebar groups: group id → path prefixes (longest prefix wins per file).
    #[serde(default)]
    pub playground_groups: HashMap<String, Vec<String>>,
    /// Extra glob lines merged with `.gitignore` / `.dslintignore` semantics.
    #[serde(default)]
    pub exclude_globs: Vec<String>,
    #[serde(default)]
    pub smell: SmellConfig,
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
}

impl DslintConfig {
    pub fn load_from_root(root: &Path) -> anyhow::Result<Self> {
        for name in DEFAULT_CONFIG_NAMES {
            let p = root.join(name);
            if p.is_file() {
                let raw =
                    std::fs::read_to_string(&p).with_context(|| format!("read {}", p.display()))?;
                return serde_json::from_str(&raw)
                    .with_context(|| format!("parse {}", p.display()));
            }
        }
        Ok(Self::default())
    }
}
