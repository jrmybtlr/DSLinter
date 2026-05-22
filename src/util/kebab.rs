//! Kebab-case → PascalCase helpers for Vue file and tag names.

use std::path::Path;

pub fn kebab_to_pascal(raw: &str) -> String {
    raw.split('-')
        .filter(|p| !p.is_empty())
        .map(|seg| {
            let mut it = seg.chars();
            match it.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().collect::<String>() + it.as_str(),
            }
        })
        .collect()
}

/// Infer PascalCase component name from a `.vue` file path stem.
pub fn component_name_from_path(path: &Path) -> Option<String> {
    path.file_stem()
        .and_then(|s| s.to_str())
        .map(kebab_to_pascal)
        .filter(|n| n.chars().next().is_some_and(|c| c.is_ascii_uppercase()))
}
