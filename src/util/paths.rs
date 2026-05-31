//! Path normalization helpers shared across workspace rules and playground emit.

use std::collections::HashMap;
use std::path::Path;

pub fn rel_path_under_root(root: &Path, file_path: &Path) -> String {
    let root_canon = std::fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    rel_path_from_canon_root(&root_canon, file_path)
}

/// Like [`rel_path_under_root`] but accepts an already-canonicalized root, avoiding
/// a redundant filesystem `canonicalize` call when the same root is used repeatedly.
pub fn rel_path_from_canon_root(root_canon: &Path, file_path: &Path) -> String {
    file_path
        .strip_prefix(root_canon)
        .ok()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
        .unwrap_or_default()
}

fn normalized_prefix(prefix: &str) -> &str {
    prefix.trim().trim_start_matches('/').trim_end_matches('/')
}

pub fn path_matches_prefix(rel: &str, prefix: &str) -> bool {
    let pre = normalized_prefix(prefix);
    if pre.is_empty() {
        return false;
    }
    let rel = rel.trim_start_matches('/');
    rel == pre || rel.starts_with(&format!("{pre}/"))
}

/// Longest matching prefix wins (nested groups).
pub fn longest_matching_group(rel: &str, groups: &HashMap<String, Vec<String>>) -> Option<String> {
    if groups.is_empty() {
        return None;
    }
    let rel = rel.trim_start_matches('/');
    let mut best: Option<(usize, String)> = None;
    for (group, prefixes) in groups {
        for pre_raw in prefixes {
            if path_matches_prefix(rel, pre_raw) {
                let len = normalized_prefix(pre_raw).len();
                if best.as_ref().is_none_or(|(l, _)| len > *l) {
                    best = Some((len, group.clone()));
                }
            }
        }
    }
    best.map(|(_, g)| g)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::longest_matching_group;

    #[test]
    fn longest_matching_group_picks_nested_prefix() {
        let mut groups = HashMap::new();
        groups.insert("outer".into(), vec!["src/components".into()]);
        groups.insert("inner".into(), vec!["src/components/nested".into()]);
        let g = longest_matching_group("src/components/nested/Foo.tsx", &groups).unwrap();
        assert_eq!(g, "inner");
    }
}
