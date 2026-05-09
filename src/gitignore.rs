//! `.gitignore` / `.dslintignore`-style patterns using globset (Rust 1.83–compatible).
//!
//! Semantics are **best-effort** vs canonical Git: patterns are applied in file order with the
//! **last matching rule winning**, so negated patterns (`!`) can re-include paths.

use std::path::Path;

use globset::{GlobBuilder, GlobSet, GlobSetBuilder};

/// One logical line from an ignore file (may compile to multiple globs).
struct IgnoreRule {
    set: GlobSet,
    /// `true` when the source line began with `!` — matching paths are **not** ignored.
    negated: bool,
}

/// Combined ignore matcher built from repo ignore files + config extras.
pub struct IgnoreEngine {
    rules: Vec<IgnoreRule>,
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

fn parse_ignore_line(raw: &str) -> Option<(bool, &str)> {
    let line = raw.trim_end_matches([' ', '\t']);
    if line.is_empty() || line.starts_with('#') {
        return None;
    }
    // `\!name` is a positive pattern whose first character is `!`, not a negation rule.
    if line.starts_with("\\!") {
        return Some((false, &line[1..]));
    }
    if let Some(rest) = line.strip_prefix('!') {
        let rest = rest.trim_start_matches([' ', '\t']);
        if rest.is_empty() {
            return None;
        }
        return Some((true, rest));
    }
    Some((false, line))
}

impl IgnoreEngine {
    pub fn from_patterns(lines: &[String]) -> anyhow::Result<Option<Self>> {
        let mut rules = Vec::new();
        for raw in lines {
            let Some((negated, pat)) = parse_ignore_line(raw) else {
                continue;
            };
            let pat = pat.trim();
            if pat.is_empty() {
                continue;
            }
            let globs = gitignore_line_to_globs(pat);
            if globs.is_empty() {
                continue;
            }
            let mut b = GlobSetBuilder::new();
            for gline in globs {
                let g = GlobBuilder::new(&gline).literal_separator(true).build()?;
                b.add(g);
            }
            rules.push(IgnoreRule {
                set: b.build()?,
                negated,
            });
        }
        if rules.is_empty() {
            return Ok(None);
        }
        Ok(Some(Self { rules }))
    }

    /// `true` if this path should be **skipped** (ignored), same as `git check-ignore` exit 0.
    pub fn matches(&self, root: &Path, path: &Path) -> bool {
        let Some(norm) = normalize_rel_path(root, path) else {
            return false;
        };
        for rule in self.rules.iter().rev() {
            if rule.set.is_match(&norm) {
                return !rule.negated;
            }
        }
        false
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
    if pat.is_empty() {
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

    #[test]
    fn negation_reincludes_file() {
        let root = PathBuf::from("/repo");
        let lines = vec!["*.log".to_string(), "!keep.log".to_string()];
        let engine = IgnoreEngine::from_patterns(&lines).unwrap().unwrap();
        assert!(engine.matches(&root, Path::new("/repo/nested/foo.log")));
        assert!(!engine.matches(&root, Path::new("/repo/pkg/keep.log")));
    }

    #[test]
    fn escaped_bang_is_not_negation() {
        let root = PathBuf::from("/repo");
        let lines = vec![r"\!special.txt".to_string()];
        let engine = IgnoreEngine::from_patterns(&lines).unwrap().unwrap();
        assert!(engine.matches(&root, Path::new("/repo/!special.txt")));
    }

    #[test]
    fn last_match_wins_between_two_positive_rules() {
        let root = PathBuf::from("/repo");
        let lines = vec![
            "target".to_string(),
            "!target/keep.txt".to_string(),
            "target/**".to_string(),
        ];
        let engine = IgnoreEngine::from_patterns(&lines).unwrap().unwrap();
        // Later `target/**` ignores everything under target again
        assert!(engine.matches(&root, Path::new("/repo/target/keep.txt")));
    }
}
