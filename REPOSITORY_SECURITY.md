# Repository security configuration

These controls were enabled and verified for `amnesia2k/sendlib-sdk` on 2026-09-13. Keep this document as the required baseline when repository ownership, workflows, or release processes change.

## GitHub security features

The following GitHub security features are active:

- Dependency graph, Dependabot alerts, and Dependabot security updates.
- Native secret scanning and push protection.
- The repository/package secret scanner run by the package-integrity CI job.

Operational requirements:

- Route dependency and security notifications to `amnesia2k` and keep the private vulnerability-reporting route described in `SECURITY.md` enabled.
- Review every Dependabot pull request normally; do not auto-merge dependency updates without CI.

## Branch and tag protection

The active `Protect master` ruleset:

- Requires a pull request before merging.
- Requires the `Node 22 quality`, `Node 24 quality`, and `Package integrity` checks.
- Requires branches to be current before merging and blocks force pushes and deletion.
- Requires review of changes under `.github/workflows/`.

The active `Protect release tags` ruleset protects tags matching `v*` from unauthorized creation, deletion, and updates. Creation is restricted to the maintainer or the future protected release workflow.

## Protected live-test environment

The `sendlib-live` environment requires maintainer approval and accepts deployments only from `master`. No credentials were created or copied while configuring Phase 7. When controlled live testing is intentionally enabled, store only dedicated non-production test values in its environment secrets:

- `SENDLIB_API_KEY`
- `SENDLIB_TEST_RECIPIENT`
- `SENDLIB_TEST_SENDER`
- `SENDLIB_TEST_TEMPLATE`

The normal `CI` workflow does not reference these secrets and cannot send email. The separate **Controlled live integration tests** workflow runs only through a manual dispatch and uses the protected environment. Fork pull requests therefore execute only secretless mocked and contract tests.

Use separate SendLib credentials for development, live integration testing, and release verification. Never reuse a production application key.

## Publishing environment

The `npm-production` environment requires maintainer approval and accepts deployments only from `v*` tags. Put publishing credentials there during Phase 8 only if npm trusted publishing is unavailable. Pull-request workflows must never reference this environment or its credentials.
