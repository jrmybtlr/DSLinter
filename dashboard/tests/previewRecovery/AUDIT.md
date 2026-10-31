# Shared preview fixes: verification

Verified against the 149-component Inertia demo on 31 October 2026. The explorer
used the production dashboard build and consumer preview host. Existing consumer
adapters and playground files retained precedence.

| Pass | Pages checked | Visible previews | Terminal guidance | Silent blanks |
| --- | ---: | ---: | ---: | ---: |
| Cold startup, isolated dependency cache | 149 | 147 | 2 | 0 |
| Warm navigation | 149 | 147 | 2 | 0 |
| After runtime hot update | 149 | 147 | 2 | 0 |

The original audit found 31 stable failures and 15 further blank previews.
Neither dependency-import errors nor invalid React hook errors recurred in these
three final passes. Concurrent explorer hosts now use separate optimizer caches.

The remaining adapter-dependent components are:

- `Icon`: requires an explicit, verified icon component fixture.
- `Toaster`: subscribes successfully through the Inertia shim, but needs a
  preview override that creates a local notification to display visible content.

These two pages show terminal guidance and are not counted as successful
previews. Visible previews with explicit consumer adapters remain authoritative;
the count does not assert that every adapter provides comprehensive examples.

Automatic recipes require the selected export. Unit coverage rejects an ordinary
Input substitute for InputOTP exports and checks every supported compound family
member. Browser checks confirmed the three OTP slots display distinct values,
and local menu/dialog triggers reveal their content. No wrong-component fallback
was observed in those checks; the page sweep measures visible output rather than
instrumenting each consumer component's internal render tree.

The React/Vue browser harness passes 21 scenarios, covering real context recovery,
provider invalidation during HMR, source import forms, explicit false values,
manual defaults, terminal layout and retry, update failures, stale navigation,
Vue injection guidance, and Inertia event cleanup. The production host lifecycle
test also verifies that consumer project files are unchanged.
