//! Shared accessibility rule messages (JSX and Vue template paths).

pub const IMG_ALT: &str =
    "`<img>` must include an `alt` attribute (empty string is OK for decorative images).";
pub const ANCHOR_HREF: &str = "`<a>` must have a meaningful `href` for navigation.";
pub const ANCHOR_PLACEHOLDER_HREF: &str =
    "Avoid empty `href`, `href=\"#\"`, or `javascript:` URLs without accessible behavior.";
pub const INPUT_LABEL: &str =
    "`<input>` should expose an accessible name (`aria-label`, `aria-labelledby`, or associated `<label htmlFor>`).";
pub const BUTTON_NAME: &str =
    "`<button>` needs visible text, `aria-label`, `aria-labelledby`, or `title`.";
