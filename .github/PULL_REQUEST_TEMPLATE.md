## Summary

Describe the user-visible problem and the chosen solution.

## Contract evidence

Link official SendLib documentation or explain why no upstream contract behavior changes.

## Verification

- [ ] I added or updated runtime and type-level tests.
- [ ] `bun run ci` passes.
- [ ] Packaging checks pass when package metadata or exports changed.
- [ ] Documentation and examples match the implementation.
- [ ] I added a Changeset when the change is user-visible and Changesets is available.

## Safety

- [ ] This change contains no real API key, authorization header, personal email data, production content, attachment, or unsanitized API response.
- [ ] Live sends remain explicitly opt-in.
- [ ] Ambiguous POST operations are not automatically retried.
