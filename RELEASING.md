# Release process

Releases are immutable, reviewed, and published without rebuilding. The first public version is `0.1.0`.

## One-time npm bootstrap

The package name is `@sendlib/node-sdk`, so an npm organization named `sendlib` must exist and `amnesia2k` must have package-creation permission. A personal `amnesia2k` account alone can publish only under the `@amnesia2k` user scope.

Before the first release:

1. Create or join the `sendlib` npm organization and confirm `amnesia2k` can publish public packages.
2. Keep account 2FA set to `auth-and-writes` and save recovery codes securely.
3. Create a short-lived granular npm token that can create/publish only `@sendlib/node-sdk`, enables publish access as required by npm, and expires promptly.
4. Store that token as `NPM_TOKEN` only in the protected GitHub `npm-production` environment.
5. Never store it as a repository-level secret, local project file, workflow literal, or long-lived general-purpose token.

The bootstrap token is needed because npm trusted publishing is configured from an existing package's settings. After the first package version exists, configure its npm trusted publisher with these exact values:

- Provider: GitHub Actions
- GitHub user: `amnesia2k`
- Repository: `sendlib-sdk`
- Workflow filename: `release.yml`
- Environment: `npm-production`
- Allowed action: direct `npm publish`

Then run a later release through OIDC, verify provenance, delete the `NPM_TOKEN` environment secret, and revoke the bootstrap token on npm. Do not fall back to a long-lived classic token.

## Version preparation

Consumer-visible pull requests add a changeset with `bun run changeset`. After such a pull request reaches `master`, the **Version packages** workflow automatically creates or updates a reviewed release PR. It can also be started manually when recovery is necessary. The version script dates the generated changelog entry automatically; confirm that date before merging the release PR.

Before merging a release PR:

```sh
bun run ci
bun run security:scan
bun run pack:check
bun run smoke:package
```

Review the package name, version, exports, license, README, changelog, dependency list, and packed files. Confirm no credential or personal live-test data is present.

## Publication

After merging the Changesets release PR, update local `master` and run one command:

```sh
git switch master
git pull --ff-only
npm run release:publish
```

The command requires a clean `master` branch matching `origin/master`. It verifies the version and changelog, runs every release check, creates the matching `vX.Y.Z` tag, and pushes only that tag. The tag starts the protected **Release** workflow, which publishes the package under npm's default `latest` tag using trusted publishing and provenance, then creates the GitHub Release.

The local command never contacts npm and never requires an npm password, token, or OTP. npm authentication is confined to the protected GitHub environment. Never move or reuse a published version's tag. If publication fails after a tag is pushed, use the workflow's manual recovery input with that existing tag; do not create another tag for the same version.

Verify the published version with a clean `npm install @sendlib/node-sdk` and check the npm provenance statement. The GitHub release is created only after npm publication succeeds.

## Failed release

Never overwrite or unpublish a published version as a routine rollback. Deprecate a broken version with a clear message, move `latest` back only to an already-verified safe version, and publish a corrected immutable version.
