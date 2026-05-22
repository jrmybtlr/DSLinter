//! Shared compiled regex patterns.

lazy_regex!(pub(crate) class_attr_re, r#"(?:class|className)\s*=\s*["']([^"']+)["']"#);

lazy_regex!(
    pub(crate) class_helper_attr_re,
    r#"(?:class|className)\s*=\s*\{\s*(?:cn|clsx|classnames)\(([^}]*)\)\s*\}"#
);

lazy_regex!(pub(crate) quoted_literal_re, r#"["']([^"']+)["']"#);

lazy_regex!(pub(crate) hex_re, r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b");

lazy_regex!(pub(crate) tw_arbitrary_re, r"\[(?:#[0-9a-fA-F]{3,8}|\d+px)\]");
