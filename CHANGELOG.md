# Changelog

All production deployments of WarEra Lab are recorded here.

Versioning follows the WarEra Lab pre-1.0 sequential deployment scheme documented in [docs/RELEASES.md](docs/RELEASES.md). One version corresponds to one production deployment and one exact deployed Git commit.

## v0.0.3 — 2026-10-06

**Production commit:** Pending production deployment — finalize after successful deploy/tag.
**Previous version:** `v0.0.2`
**Environment:** Production — `https://warera-lab.rocsi.eu/`

### Summary

Establishes WarEra Lab's multi-lab application shell and a reload-safe Company Lab context contract. Users can move between Economy Lab and Company Lab while carrying a selected public player/company identity, without introducing a routing dependency or prematurely adding Company Lab analytics.

### Added

- Public Economy Lab / Company Lab module navigation.
- Stable query-string lab context using `lab`, `player`, and `company` parameters.
- Company Lab context-only entry and company-selection shell.
- Recovery states for missing, invalid, or no-longer-available player/company link context.
- Focused unit and browser coverage for URL parsing, reload, back/forward navigation, exact-320 px layout, and accessibility.

### Changed

- Player snapshot import is shared between interactive search and direct lab-link rehydration rather than duplicated per lab.
- The existing company selector is shared by Economy Lab and Company Lab.
- Portable scenario links explicitly remove live lab/player/company query context so `#wl=…` shares remain detached and reload without live API lookup.

### Fixed

None.

### Verification

- Pre-merge repository verification pending final review of the exact proposed tree.

### Known limitations

- Company Lab intentionally establishes only shell, navigation, and selected-company context in this release; analytical company content remains scoped to #47–#50.
- Company Lab's complete responsive/accessibility/E2E release gate remains scoped to #51.
- Market Lab and Player Lab remain future modules.

### References

- #46 — Establish the multi-lab shell and Company Lab context contract
- #43 — Plan and deliver Company Lab MVP

## v0.0.2 — 2026-10-02

**Production commit:** `0a8e3f9593ef34d22540c25853326af1d6600631`
**Previous version:** `v0.0.1`
**Environment:** Production — `https://warera-lab.rocsi.eu/`

### Summary

Introduces WarEra Lab's explicit release-version and changelog system before Company Lab development begins. The deployed application now exposes its release version in the public footer while retaining exact Git-SHA deployment traceability.

### Added

- Canonical repository-level `VERSION` source for the deployed application version.
- Public footer release-version indicator.
- Production-oriented `CHANGELOG.md`.
- Documented sequential release and deployment workflow.
- Automated release-version consistency verification, including the `.99 → next minor` rollover rule.

### Changed

- README now reflects the live Economy Lab MVP and points to the canonical version, changelog, and release process.
- The web build consumes the root `VERSION` value rather than maintaining a separate UI version string.
- The standard verification gate now checks release-version consistency before the rest of the build/test suite.

### Fixed

None.

### Verification

- Proposed PR tree `e696eb37bde1cdcaa9de46e3bcd61af6a871fbb6` passed `npm run verify`: release consistency, formatting, lint, production build, typecheck, 99 Vitest tests, and 34 Playwright tests.
- GitHub CI run #57 passed on the PR head before merge.
- Squash-merged production commit `0a8e3f9593ef34d22540c25853326af1d6600631` has the identical tested tree `e696eb37bde1cdcaa9de46e3bcd61af6a871fbb6`.
- Exact-SHA production deployment completed successfully from `0a8e3f9593ef34d22540c25853326af1d6600631`.
- Deployment metadata, the active release symlink, and root `VERSION` agree on the deployed SHA and `v0.0.2`.
- Local and public `/api/health` returned healthy responses.
- `warera-lab-api.service` remained active with `NRestarts=0` and no recent warning-level service log entries.
- Public desktop and exact-320 browser checks showed visible `v0.0.2`, the expected changelog link, and zero horizontal overflow.
- Production install/build reported zero npm vulnerabilities.
- Lightweight tag `v0.0.2` was created and verified to resolve directly to production commit `0a8e3f9593ef34d22540c25853326af1d6600631`.
- GitHub Release `v0.0.2 — Release versioning and changelog` was published and verified as the repository's latest release.

### Known limitations

- None specific to the release-version/changelog system.

### References

- PR #61 — release versioning and changelog implementation
- #60 — Introduce release versioning and changelog before Company Lab
- #46 — Company Lab start gate

## v0.0.1 — 2026-10-02

**Production commit:** `b6cc71df304847af8e2e063ea5f8c547039b509e`
**Previous version:** Initial baseline
**Environment:** Production — `https://warera-lab.rocsi.eu/`

### Summary

First versioned production baseline for WarEra Lab. This release establishes Economy Lab v1 as MVP-ready: a credential-free public workflow for importing live WarEra economy data, building hypothetical scenarios, comparing outcomes, explaining calculations, and sharing portable scenarios without server-side persistence.

### Added

- Public WarEra player search and normalized player snapshot import.
- Economy Lab skill planner for Production, Entrepreneurship, Management, and Companies skills.
- Company upgrade planner for Automated Engine, Storage, and Break Room.
- Market and margin simulation using live public market references and explicit user assumptions.
- Baseline, Scenario A, and Scenario B comparison workflow.
- Calculation explanations with observed, derived, assumed, and overridden provenance.
- Portable JSON scenario export and URL-fragment sharing.
- Public snapshot and Economy-context freshness information.
- Explicit `Refresh snapshot` action.
- Responsive company selection for larger player portfolios.

### Changed

- Mobile company selection was compacted while preserving meaningful same-name company disambiguation.
- Ordinary search results now show meaningful player information without exposing opaque WarEra country IDs.
- User-facing numeric values are consistently formatted.
- Economy Lab public shell, hero, footer, mobile layout, and narrow-screen behavior were refined for the MVP release.

### Fixed

- Removed horizontal overflow from the supported exact 320 px viewport.
- Removed opaque country IDs from player-search presentation.
- Reduced excessive vertical travel through large company portfolios on mobile.
- Refresh failures preserve the existing visible snapshot, Economy context, selected company, and hypothetical scenarios.
- If a selected company disappears after refresh, WarEra Lab falls back deterministically without transferring the previous company's hypothetical scenario to the replacement company.

### Verification

- Final live production regression completed using `MihaiROCSI`.
- Live snapshot contained 9 companies: 2 × Steel Inc and 7 × Iron Inc.
- Exact 320 px checks passed with `scrollWidth === clientWidth` before search, after search, after import, and after refresh.
- Nine-company mobile selector measured approximately 720 px, more than 50% below the original closure baseline.
- Live iron and steel Economy contexts loaded without context gaps.
- Scenario A/B editing, comparison, calculation explanation, and version provenance were verified in production.
- Default JSON exports and URL shares excluded player username and public player ID.
- A shared scenario reconstructed in a fresh browser without making live API requests.
- Browser networking remained same-origin.
- No cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, or service-worker persistence was present.
- Integrated live workspace reported zero automated Axe accessibility violations.
- Keyboard navigation and visible focus treatment were verified.
- Snapshot refresh success, rate-limit failure, Economy-context failure, selected-company preservation, and disappearance fallback were production-verified.
- Production API health checks passed with `NRestarts=0` and no relevant service errors.

### Known limitations

- Economy Lab intentionally does not infer unverified WarEra formulas such as worker productivity, taxes, region modifiers, or other game mechanics whose calculation semantics have not been established.
- Scenarios are browser-local/shareable; WarEra Lab has no account-based scenario storage.
- Historical snapshots, automatic refresh/polling, notifications, and watchlists are outside the MVP.
- Company Lab, Market Lab, and Player Lab remain future modules.

### References

- #19 — First Economy Lab web experience and release gate
- #54 — Search-result opaque-ID / 320 px closure fix
- #55 — Compact mobile company selection
- #56 — Explicit snapshot refresh
- PR #57
- PR #58
- PR #59
- #60 — Release versioning and changelog
