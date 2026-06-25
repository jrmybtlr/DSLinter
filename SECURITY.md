# Security Policy

## Supported Versions

Security fixes are applied to the latest release on the default branch. Older published npm versions are not actively supported unless a critical issue affects downstream consumers.

## Reporting a Vulnerability

If you discover a security vulnerability in DSLinter, please report it responsibly:

1. **Do not** open a public GitHub issue for security-sensitive reports.
2. Email the maintainer via the contact listed on the [GitHub profile](https://github.com/jrmybtlr) or open a [private security advisory](https://github.com/jrmybtlr/DSLinter/security/advisories/new) on GitHub.
3. Include a clear description, reproduction steps, and impact assessment if known.

You can expect an initial response within 7 days. We will work with you to understand and address valid reports before public disclosure.

## Scope

In scope:

- The `dslinter` npm package and CLI (`packages/dashboard`)
- First-party code in this repository
- Documented configuration and MCP integration surfaces

Out of scope:

- Vulnerabilities in demo applications (`demo/react/`, `demo/inertia/`) unless they demonstrate a flaw in the published package
- Third-party dependencies (report upstream; we track Dependabot alerts separately)
- Issues requiring local dev servers (Vite/Vitest) to be intentionally exposed to untrusted networks

## Dependency Security

This repository uses Dependabot and CodeQL. Dependency updates and security patches are handled via pull requests against the default branch.
