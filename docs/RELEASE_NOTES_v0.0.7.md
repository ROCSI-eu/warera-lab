# v0.0.7 — Player Lab MVP

> **Draft only.** Do not publish until the owner has approved deployment, the exact Git commit is deployed and production acceptance is verified. Complete the production placeholders from actual evidence.

## Summary

Introduces Player Lab, a public player-centric starting point for the existing WarEra Lab tools, with read-only profile, skills, company outputs and contextual navigation.

## Highlights

- Search/import a public player and inspect identity, country, economy skills, and explicit data freshness/provenance.
- Browse up to twelve owned companies, including safe disambiguation of identically named companies.
- Move into Economy, Company, or Market Lab with validated, relevant identifiers and no hypothetical scenario-state transfer.
- Clear degraded-state handling, a manual retry when an initial player link fails, responsive/keyboard/accessibility release testing, and readable skill labels at exactly 320 px.

## Production verification

- **Production commit:** Pending owner-approved deployment.
- **Version and service checks:** Pending.
- **Player Lab and cross-lab live smoke, desktop/mobile/320 px:** Pending.
- **Automated test evidence:** PR #104 implementation head `8234832` passed [GitHub Actions full verification](https://github.com/ROCSI-eu/warera-lab/actions/runs/37945476289) with 168 Vitest and 136 Playwright tests; final release-documentation head requires its own CI confirmation before merge.

## Known limitations

- Public current-state information only; no authenticated game data or tracked player history.
- Company output codes are not owned item balances, and reported production does not confirm current activity.
- Unavailable, stale or incomplete source data is not estimated; market items are fetched separately.
- Physical mobile-device tests are not claimed; browser-based mobile emulation is the release automation baseline.
- Four-lab UX review (#93) and stabilization (#94) are not part of this release.

## Contributors

- @mihaibarbulescu
