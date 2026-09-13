# Release process

Releases are immutable, reviewed, and promoted without rebuilding. The first public version is `0.1.0`.

## One-time npm bootstrap

The package name is `@sendlib/node-sdk`, so an npm organization named `sendlib` must exist and `amnesia2k` must have package-creation permission. A personal `amnesia2k` account alone can publish only under the `@amnesia2k` user scope.

Before the first candidate:

1. Create or join the `sendlib` npm organization and confirm `amnesia2k` can publish public packages.
2. Keep account 2FA set to `auth-and-writes` and save recovery codes securely.
3. Create a short-lived granular npm token that can create/publish only `@sendlib/node-sdk`, enables publish access as required by npm, and expires promptly.
4. Store that token as `NPM_TOKEN` only in the protected GitHub `npm-production` environment.
5. Never store it as a repository-level secret, local project file, workflow literal, or long-lived general-purpose token.

The bootstrap token is needed because npm trusted publishing is configured from an existing package's settings. After the first candidate exists, configure its npm trusted publisher with these exact values:

- Provider: GitHub Actions
- GitHub user: `amnesia2k`
- Repository: `sendlib-sdk`
- Workflow filename: `release.yml`
- Environment: `npm-production`
- Allowed action: direct `npm publish`

Then run a later candidate through OIDC, verify provenance, delete the `NPM_TOKEN` environment secret, and revoke the bootstrap token on npm. Do not fall back to a long-lived classic token.

## Version preparation

Consumer-visible pull requests add a changeset with `bun run changeset`. Run the manual **Version packages** workflow from `master` to create or update a reviewed release PR. For the initial `0.1.0`, review the already-selected package version and replace `Unreleased` in its changelog heading with the release date.

Before merging a release PR:

```sh
bun run ci
bun run security:scan
bun run pack:check
bun run smoke:package
```

Review the package name, version, exports, license, README, changelog, dependency list, and packed files. Confirm no credential or personal live-test data is present.

## Candidate publication

After the release commit passes protected CI, create and push exactly one protected tag matching the package version:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The tag starts the approval-gated **Release candidate** workflow. It verifies that the tag and dated changelog match, reruns every release check, and publishes the tagged source as `@sendlib/node-sdk@0.1.0` under the `next` dist-tag with provenance.

Do not create a different artifact for stable release. Install and test `@sendlib/node-sdk@next`, then promote the exact version:

```sh
npm dist-tag add @sendlib/node-sdk@0.1.0 latest
```

The promotion is an npm registry metadata change only. It must not rebuild or republish the package. Create the matching GitHub release from the already-pushed tag and the reviewed changelog.

## Failed release

Never overwrite or unpublish a published version as a routine rollback. Deprecate a broken version with a clear message, move `latest` back only to an already-verified safe version, and publish a corrected immutable version.
