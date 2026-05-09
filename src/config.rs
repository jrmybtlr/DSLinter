//! Optional `.dslint.json` configuration.

use std::collections::HashMap;
use std::path::Path;

use anyhow::Context;
use serde::Deserialize;

const DEFAULT_CONFIG_NAMES: &[&str] = &[".dslint.json", "dslint.json"];

#[derive(Debug, Clone, Deserialize, Default)]
pub struct SmellConfig {
    /// Rule ids or prefixes (`smell-*`) to silence for this repo.
    #[serde(default)]
    pub disabled_rules: Vec<String>,
    /// When false, `console.error` calls are not reported (`smell-console-error` dropped).
    #[serde(default = "default_true")]
    pub report_console_error: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct DslintConfig {
    /// Component names (exact JSX identifiers) that should not be used.
    #[serde(default)]
    pub deprecated_components: Vec<String>,
    /// Arbitrary token names your design system defines (for adoption metrics).
    #[serde(default)]
    pub known_tokens: Vec<String>,
    /// Map of owner label → path prefixes (slash-normalized, relative to repo root).
    #[serde(default)]
    pub ownership: HashMap<String, Vec<String>>,
    /// Extra glob lines merged with `.gitignore` / `.dslintignore` semantics.
    #[serde(default)]
    pub exclude_globs: Vec<String>,
    #[serde(default)]
    pub smell: SmellConfig,
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
