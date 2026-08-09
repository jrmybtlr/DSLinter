# Fix PR #42 review findings

Base: `improvements` → branch `cursor/fix-review-findings-ad81`

## Checklist

- [ ] Breakpoint preset shows current value; avoid uncontrolled→controlled Select flip
- [ ] Compound `valuesToProps` coerces `stringArray` (reuse propCoerce helpers)
- [ ] Align compound control inference with “no faking” / non-editable controls
- [ ] Remove/fix a11y bare-`id` skip; fix Vue `contains("id=")` false negatives
- [ ] Align ECMA vs Vue select/textarea severities
- [ ] Extract `declared_prop_options` from Vue runtime `PropType<'a'|'b'>`
- [ ] Vue AST: don’t trust recovered parses with errors; harden template-literal skip
- [ ] Tighten `score_deltas` JSDoc in baseline-drift.mjs
- [ ] Fix ROADMAP links (public stub or retarget)
- [ ] Document UseClassy + drift flags in dashboard README
- [ ] Changelog + version bump to 0.7.1
- [ ] Regenerate demo/inertia report; clean inertia format tooling
- [ ] Tests for the above; verify

## Review

(pending)
