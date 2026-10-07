# Release versioning and production deployment

WarEra Lab uses a pre-1.0 sequential **deployment version**. It is SemVer-shaped for familiarity, but the components follow this project-specific release rule rather than strict semantic-version meaning.

## Version sequence

The Economy Lab MVP baseline is `v0.0.1`.

Every successful production website deployment advances by one release step:

- `v0.0.1 → v0.0.2 → ... → v0.0.99 → v0.1.0`
- `v0.1.0 → v0.1.1 → ... → v0.1.99 → v0.2.0`

`v1.0.0` is a deliberate product milestone and is never reached automatically.

One version corresponds to one production deployment and one exact deployed Git commit. Versions are never reused. A rollback restores the version already associated with the rollback target and does not create a new release number merely for switching back.

## Sources of truth

- [`VERSION`](../VERSION) is the single canonical application release version.
- [`CHANGELOG.md`](../CHANGELOG.md) is the human-readable production deployment history.
- The Git tag matching the release version provides the immutable version-to-production-commit mapping.
- The production `.deployment-sha` continues to identify the exact deployed Git commit.

The private npm workspace versions are package metadata and are not the WarEra Lab production release version.

## Changelog entry contract

Every production deployment entry contains:

- release version and deployment date;
- exact production commit SHA;
- previous version;
- production environment;
- Summary;
- Added;
- Changed;
- Fixed;
- Verification;
- Known limitations;
- References.

Empty sections remain present and use `None` or `None known`.

The changelog describes what reached production. It is not a commit log. Internal refactors, test changes, and dependency work belong in a release entry only when they materially affect deployed behavior, operation, reliability, security, privacy, or traceability.

Historical release behavior is not rewritten to make the record cleaner. Correct factual typos when necessary; behavioral corrections belong in the next release entry.

## Production release checklist

For each production deployment:

1. Confirm the currently deployed version and exact deployed SHA.
2. Calculate the next version using the sequential rule above.
3. Update only the root `VERSION` as the canonical version value.
4. Add the new `CHANGELOG.md` entry. Before merge, its Production commit may use the approved pending-deployment placeholder.
5. Run `npm run verify:release`.
6. Run the complete `npm run verify` gate on the exact proposed tree.
7. Review the diff and affected desktop/mobile/320 px visual baselines.
8. Merge only the exact tested tree.
9. Confirm the merged commit has the same tree as the tested PR head.
10. Deploy the exact merged commit SHA.
11. Verify API/service health and release-specific production acceptance criteria.
12. Confirm the public UI reports the expected `VERSION`.
13. Create the Git tag matching the release version at the exact deployed commit.
14. Confirm the tag, production `.deployment-sha`, and visible application version all identify the same release.
15. Replace the changelog's pending Production commit with the exact deployed SHA and record final verification evidence in a documentation-only follow-up commit. This follow-up is not deployed and does not consume the next release number.

A documentation-only changelog finalization commit is permitted after deployment because the application version remains unchanged and no new production artifact is created.

## Tags and GitHub Releases

A Git tag named exactly like the canonical version (for example `v0.0.5`) is required for every versioned production deployment.

The historical Economy Lab MVP baseline is:

- `v0.0.1`
- production commit `b6cc71df304847af8e2e063ea5f8c547039b509e`
- production date 2026-10-02

Starting with `v0.0.5`, every production deployment should also have a published GitHub Release using one consistent format.

### Release title

Use:

`<version> — <short release name>`

Example:

`v0.0.5 — Company Lab MVP`

### Release body

Use these sections, in this order:

1. `## Summary`
2. `## Highlights`
3. `## Production verification`
4. `## Known limitations`
5. `## Contributors`

Keep the release body concise and production-facing. Do not reproduce the full changelog entry.

The **Production verification** section should record the exact deployed commit and the most important release-specific smoke evidence. The **Contributors** section should list the human contributors to that release by GitHub handle. As of `v0.0.5`, the sole contributor is `@mihaibarbulescu`; expand the list when that changes.

Publish the release as **Latest** unless it is intentionally a prerelease. Do not attach binaries for ordinary website-only releases unless the release has a distributable artifact that users need to download.
