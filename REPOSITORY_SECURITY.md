# Repository security configuration

The workflow files enforce safe defaults in code, but GitHub account settings must also be configured by the repository owner. Complete this checklist after the files reach the default branch.

## GitHub security features

In **Settings → Code security and analysis**:

- Enable the dependency graph, Dependabot alerts, Dependabot security updates, secret scanning, and push protection.
- Route dependency and security notifications to `amnesia2k` and keep the private vulnerability-reporting route described in `SECURITY.md` enabled.
- Review every Dependabot pull request normally; do not auto-merge dependency updates without CI.

## Branch and tag protection

Create a ruleset for `master` that:

- Requires a pull request before merging.
- Requires the `Node 22 quality`, `Node 24 quality`, and `Package integrity` checks.
- Requires branches to be current before merging and blocks force pushes and deletion.
- Requires review of changes under `.github/workflows/`.

Create a tag ruleset for release tags matching `v*` that blocks deletion and updates. Restrict creation to the maintainer or the future protected release workflow.

## Protected live-test environment

Create a GitHub Actions environment named `sendlib-live`, restrict it to the `master` branch, and require maintainer approval. Store only dedicated non-production test values in its environment secrets:

- `SENDLIB_API_KEY`
- `SENDLIB_TEST_RECIPIENT`
- `SENDLIB_TEST_SENDER`
- `SENDLIB_TEST_TEMPLATE`

The normal `CI` workflow does not reference these secrets and cannot send email. The separate **Controlled live integration tests** workflow runs only through a manual dispatch and uses the protected environment. Fork pull requests therefore execute only secretless mocked and contract tests.

Use separate SendLib credentials for development, live integration testing, and release verification. Never reuse a production application key.

## Publishing environment

Create a separate environment named `npm-production` during Phase 8. Require manual approval, restrict it to protected release tags or the protected default branch, and put publishing credentials only there if npm trusted publishing is unavailable. Pull-request workflows must never reference this environment or its credentials.
