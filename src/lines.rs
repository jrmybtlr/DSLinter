//! Fast byte-offset → 1-indexed line-number utilities.
//!
//! # Usage
//!
//! For hot loops that resolve many offsets in the same source string, prefer the
//! two-function precompute + lookup API:
//!
//! ```ignore
//! let nls = newline_offsets(source);
//! for m in regex.find_iter(source) {
//!     let line = line_of_offset(&nls, m.start());
//! }
//! ```
//!
//! This costs O(n) once to build the offset table, then O(log n) per lookup,
//! versus the naive O(n) per lookup.

/// Collect the byte offset of every `\n` in `source` (sorted ascending).
///
/// Combine with [`line_of_offset`] for O(log n) per-offset lookups when
/// resolving many positions in the same source string.
pub fn newline_offsets(source: &str) -> Vec<usize> {
    source
        .bytes()
        .enumerate()
        .filter_map(|(i, b)| if b == b'\n' { Some(i) } else { None })
        .collect()
}

/// Return the 1-indexed line number for a byte `offset` in O(log n), using
/// the precomputed newline positions returned by [`newline_offsets`].
pub fn line_of_offset(newlines: &[usize], offset: usize) -> u32 {
    // Count how many newlines appear *before* this offset — that equals
    // (line - 1), so adding 1 gives the 1-indexed line number.
    (1 + newlines.partition_point(|&nl| nl < offset)) as u32
}

/// Single-shot O(n) line lookup.  For call sites that resolve only one offset
/// per source string this is equivalent to the two-function API above.
/// Use [`newline_offsets`] + [`line_of_offset`] in loops.
pub fn offset_line(source: &str, offset: usize) -> u32 {
    1 + source[..offset.min(source.len())]
        .bytes()
        .filter(|&b| b == b'\n')
        .count() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_line_source() {
        let src = "hello world";
        let nls = newline_offsets(src);
        assert_eq!(line_of_offset(&nls, 0), 1);
        assert_eq!(line_of_offset(&nls, 5), 1);
        assert_eq!(line_of_offset(&nls, 10), 1);
    }

    #[test]
    fn multi_line_source() {
        let src = "a\nb\nc\n";
        let nls = newline_offsets(src); // newlines at 1, 3, 5
        assert_eq!(line_of_offset(&nls, 0), 1); // 'a'
        assert_eq!(line_of_offset(&nls, 1), 1); // '\n'
        assert_eq!(line_of_offset(&nls, 2), 2); // 'b'
        assert_eq!(line_of_offset(&nls, 3), 2); // '\n'
        assert_eq!(line_of_offset(&nls, 4), 3); // 'c'
        assert_eq!(line_of_offset(&nls, 5), 3); // '\n'
    }

    #[test]
    fn offset_line_agrees_with_precomputed() {
        let src = "line1\nline2\nline3";
        let nls = newline_offsets(src);
        for (i, _) in src.char_indices() {
            assert_eq!(
                line_of_offset(&nls, i),
                offset_line(src, i),
                "mismatch at byte {i}"
            );
        }
    }

    #[test]
    fn offset_past_end() {
        let src = "a\nb";
        let nls = newline_offsets(src);
        assert_eq!(line_of_offset(&nls, 100), 2);
        assert_eq!(offset_line(src, 100), 2);
    }
}
