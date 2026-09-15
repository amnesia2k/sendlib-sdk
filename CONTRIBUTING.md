# Contributing to @sendlib/node-sdk

Thank you for improving this unofficial community SDK. Contributions must preserve its independence from SendLib, protect credentials and email data, and distinguish documented API behavior from assumptions.

## Development setup

Requirements:

- Node.js 22 or newer.
- Bun 1.3.12, matching the `packageManager` field.
- Git.

Install the frozen dependency graph and run the local quality suite:

```sh
bun install --frozen-lockfile
bun run ci
```

Useful focused commands:

```sh
bun run format
bun run lint
bun run typecheck
bun run typecheck:examples
bun run test:unit
bun run test:contract
bun run test:coverage
bun run security:scan
bun run smoke:package
```

## Pull-request expectations

1. Open or reference an issue when behavior, public types, or API compatibility will change.
2. Keep changes focused and avoid unrelated formatting or dependency churn.
3. Add runtime and type-level tests for public behavior.
4. Add focused tests for behavior changed by the contribution. Coverage is measured during release checks with an 80% floor; ordinary pull requests are not blocked on perfect coverage.
5. Run `bun run ci`. For security or packaging changes, also run `bun run security:scan`, `bun run smoke:package`, and `bun run pack:check`.
6. Update README examples and `CONTRACT.md` when relevant.
7. Add a Changeset for every consumer-visible change with `bun run changeset`; pure test, CI, and internal-only maintenance does not require one.

Maintainers should follow the approval-gated process in [RELEASING.md](./RELEASING.md) when preparing or publishing a version.

Commits and pull requests must not contain real API keys, authorization headers, personal email addresses, production message bodies, attachment content, or unsanitized API responses.

## API contract changes

`CONTRACT.md` records the evidence behind public request and response types. When SendLib changes:

1. Link the exact official documentation or provide a sanitized, reproducible response.
2. Identify whether the change is documented, demonstrated, or still unverified.
3. Add or update sanitized fixtures without personal information.
4. Keep unknown fields forward-compatible when the upstream schema is incomplete.
5. Add a decision entry for compatibility-sensitive behavior.
6. Classify the SDK change using Semantic Versioning.

Never use a live account merely to explore destructive or high-volume behavior. Any controlled integration test must use maintainer-approved credentials and recipients and retain its explicit opt-in gate.

## Review and release

The maintainer reviews correctness, contract evidence, security, compatibility, tests, and documentation. Approval does not guarantee immediate release. Releases are versioned and changelogged through Changesets, then published through the protected release process planned for the repository.

By participating, you agree to follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Security vulnerabilities must follow [SECURITY.md](./SECURITY.md), not a public issue.
