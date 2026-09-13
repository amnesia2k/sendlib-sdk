# Changesets

Add a changeset to every pull request that changes the published SDK's behavior, public types, documentation, or package metadata:

```sh
bun run changeset
```

Choose the smallest appropriate Semantic Versioning impact:

- `patch`: backward-compatible fixes and documentation corrections.
- `minor`: backward-compatible features. During `0.x`, use `minor` for intentional breaking changes and include migration guidance.
- `major`: reserved for stable-major breaking changes after `1.0.0`.

Pure tests, CI maintenance, and internal refactors that cannot affect consumers do not require a changeset. Never edit generated release PR version or changelog changes by hand unless correcting inaccurate release notes.
