# v0.0.7 — Player Lab MVP

## Summary

Introduces Player Lab, a public player-centric starting point for the existing WarEra Lab tools, with read-only profile, skills, company outputs and contextual navigation.

## Highlights

- Search/import a public player and inspect identity, country, economy skills, and explicit data freshness/provenance.
- Browse up to twelve owned companies, including safe disambiguation of identically named companies.
- Move into Economy, Company, or Market Lab with validated, relevant identifiers and no hypothetical scenario-state transfer.
- Clear degraded-state handling, a manual retry when an initial player link fails, responsive/keyboard/accessibility release testing, and readable skill labels at exactly 320 px.

## Production verification

- **Published release:** [v0.0.7 — Player Lab MVP](https://github.com/ROCSI-eu/warera-lab/releases/tag/v0.0.7), 2026-10-09.
- **Production commit:** `d4df7435f6c57ade330d5bf03c8d3c3e971ee14d`, deployed from the squash-merged PR #104. The merged and exact tested PR head share tree `3ab377bb1c957107b32036ce050d6cd1c94de484`.
- **Version/service checks:** Public UI and root `VERSION` reported `v0.0.7`; production `.deployment-sha` matched the production commit; public website and `/api/health` returned HTTP 200. The `warera-lab-api` systemd service was active with zero unexpected restarts after deployment. The `v0.0.6` release was retained for rollback.
- **Automated tests:** Final PR #104 head `7ea2364f88b7d2df4f63678c51cfc26ac6f20066` passed [full GitHub Actions verification](https://github.com/ROCSI-eu/warera-lab/actions/runs/37977110508) with 168 Vitest tests and 136 Playwright cases, release-version checks, formatting, build, lint and typechecks; Codex review was positive with earlier review threads resolved.
- **Live Player Lab smoke:** Desktop 1440 px, emulated mobile 390 px, exact 320 px and reduced-motion Chromium configurations. Live `MihaiROCSI` search/import, nine-company portfolio, direct deep links and Back navigation passed.
- **Cross-lab smoke:** Company, Economy and Market handoffs preserved validated player/company/item context; live economy-context and selected market-item API calls returned HTTP 200 (selected item `fish`).
- **Accessibility/privacy observations:** No horizontal overflow at tested widths or at 320 px handoff destinations; 320 px skill labels remained on one line; scoped axe checks at desktop and 320 px found zero WCAG 2/2.1/2.2 violations. No browser page errors, cross-origin requests or local/session/IndexedDB storage data were observed in these flows.
- **Evidence:** [Production acceptance in #99](https://github.com/ROCSI-eu/warera-lab/issues/99#issuecomment-6087977462).

## Known limitations

- Public current-state information only; no authenticated game data or tracked player history.
- Company output codes are not owned item balances, and reported production does not confirm current activity.
- Unavailable, stale or incomplete source data is not estimated; market items are fetched separately.
- Physical Android/iOS device tests were not performed; browser-based mobile emulation was used for acceptance. Live upstream 503/429 failure paths were not deliberately triggered (they have fixture-based automated coverage). Browser cookie, Authorization-header and Fetch credential-mode exclusion were not asserted.
- Four-lab UX review (#93) and stabilization (#94) are not part of this release.

## Contributors

- @mihaibarbulescu
