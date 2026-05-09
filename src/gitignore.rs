//! `.gitignore` / `.dslintignore`-style patterns using globset (Rust 1.83–compatible).

use std::path::Path;

use globset::{GlobBuilder, GlobSet, GlobSetBuilder};

/// Combined ignore matcher built from repo ignore files + config extras.
pub struct IgnoreEngine {
    set: GlobSet,
}

fn normalize_rel_path(root: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(root).ok()?;
    let s: String = rel
        .components()
        .map(|c| c.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/");
    Some(s)
}

impl IgnoreEngine {
    pub fn from_patterns(lines: &[String]) -> anyhow::Result<Option<Self>> {
        let mut b = GlobSetBuilder::new();
        let mut any = false;
        for raw in lines {
            let line = raw.trim();
            if line.is_empty() || line.starts_with('#') || line.starts_with('!') {
                continue;
            }
            for gline in gitignore_line_to_globs(line) {
                let g = GlobBuilder::new(&gline).literal_separator(true).build()?;
                b.add(g);
                any = true;
            }
        }
        if !any {
            return Ok(None);
        }
        Ok(Some(Self { set: b.build()? }))
    }

    pub fn matches(&self, root: &Path, path: &Path) -> bool {
        let Some(norm) = normalize_rel_path(root, path) else {
            return false;
        };
        self.set.is_match(norm)
    }
}

pub fn load_ignore_file_lines(path: &Path) -> anyhow::Result<Vec<String>> {
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let text = std::fs::read_to_string(path)?;
    Ok(text.lines().map(|l| l.to_string()).collect())
}

fn gitignore_line_to_globs(pat: &str) -> Vec<String> {
    let pat = pat.trim();
    if pat.is_empty() || pat.starts_with('!') {
        return Vec::new();
    }

    let dir_only = pat.ends_with('/');
    let core = pat.trim_end_matches('/');

    let anchored_root = core.starts_with('/');
    let body = core.trim_start_matches('/');

    let mut base = if body.contains('*') || body.contains('?') || body.contains('[') {
        if anchored_root {
            body.to_string()
        } else {
            format!("**/{}", body)
        }
    } else if anchored_root {
        body.to_string()
    } else if body.contains('/') {
        format!("**/{}", body)
    } else {
        format!("**/{}", body)
    };

    if dir_only && !base.ends_with("/**") {
        base = format!("{}/**", base.trim_end_matches('/'));
        return vec![base];
    }

    // Plain name like `node_modules`: match file path segment and tree
    if !dir_only
        && !body.contains('*')
        && !body.contains('?')
        && !body.contains('/')
        && !base.contains("/**")
    {
        return vec![base.clone(), format!("{}/**", base)];
    }

    vec![base]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn ignores_node_modules_tree() {
        let root = PathBuf::from("/repo");
        let engine = IgnoreEngine::from_patterns(&["node_modules".to_string()])
            .unwrap()
            .unwrap();
        assert!(engine.matches(&root, Path::new("/repo/node_modules/foo.ts")));
        assert!(!engine.matches(&root, Path::new("/repo/src/App.tsx")));
    }
}
