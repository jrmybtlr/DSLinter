//! Shared compiled regex for line-oriented text rules (suppressions, TODO markers).

use std::sync::OnceLock;

use regex::Regex;

fn suppression_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?m)//.*\beslint-disable\b|@ts-ignore\b|@ts-expect-error\b|@ts-nocheck\b")
            .expect("suppression regex")
    })
}

fn todo_marker_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?m)//\s*(TODO|FIXME|HACK)\b|/\*\s*(TODO|FIXME|HACK)\b").expect("todo regex")
    })
}

/// Match start offsets for suppression comments (`eslint-disable`, `@ts-ignore`, etc.).
pub fn suppression_match_iter(source: &str) -> impl Iterator<Item = regex::Match<'_>> + '_ {
    suppression_re().find_iter(source)
}

/// Match start offsets for TODO / FIXME / HACK markers.
pub fn todo_marker_match_iter(source: &str) -> impl Iterator<Item = regex::Match<'_>> + '_ {
    todo_marker_re().find_iter(source)
}
