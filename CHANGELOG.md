# Changelog

All production deployments of WarEra Lab are recorded here.

Versioning follows the WarEra Lab pre-1.0 sequential deployment scheme documented in [docs/RELEASES.md](docs/RELEASES.md). One version corresponds to one production deployment and one exact deployed Git commit.

## v0.0.7 — 2026-10-09

**Production commit:** Pending production deployment — finalize after successful deploy/tag.
**Previous version:** `v0.0.6`
**Environment:** Production — `https://warera-lab.rocsi.eu/`

### Summary

Release candidate for Player Lab MVP: a public, player-centered hub combining normalized identity, economic skills, owned-company outputs, and contextual handoffs into the existing Economy, Company and Market Labs.

### Added

- Player Lab route and reload-safe public player snapshot search/import and manual refresh with explicit freshness and source details.
- Player identity, country, observed skills, and concise owned-company/output overview, including duplicate-name identity disambiguation and realistic twelve-company lists.
- Purpose-specific handoffs to Economy, Company and Market Labs carrying verified player/company/item identifiers only.
- Dedicated Player Lab responsive, failure-recovery, keyboard, accessibility, privacy and visual regression release-gate coverage, including desktop, representative mobile, exactly 320 px and reduced-motion modes.

### Changed

- Player Lab loads only the necessary read-only public snapshot, with no automatic Economy/Market context fan-out.
- Absent, stale, unavailable, and rate-limited snapshot states retain transparent status and manual retry behavior.
- Shared release-candidate documentation covers Player Lab workflows and versioned production acceptance.

### Fixed

- At 320 px, observed economic skill labels no longer break in the middle of words; their labels and reported levels/values remain readable.
- Failed initial Player Lab deep links expose an explicit manual retry for the same validated public player and company identifiers, including unavailable and rate-limited responses.

### Verification

- Player Lab-specific Playwright journey/accessibility checks passed on desktop and emulated mobile (10/10), including initial 503/429 deep-link retry, with 320 px keyboard/focus/no-overflow, WCAG 2.2 scoped axe and no browser-side credential/storage/polling assertions.
- All 44 existing and new visual checks passed during release baseline generation: Economy, Company, Market, and Player Lab at desktop, emulated mobile, exactly 320 px and reduced-motion settings. The only added visual baseline files belong to Player Lab.
- The narrow-screen typography fix was validated with a 9/9 targeted rerun and inspected in the regenerated 320 px screenshots.
- PR #104 follow-up implementation head `8234832cbfed3fb023f8d5d8af5d713a8ce7718f` passed [GitHub Actions run #37945476289](https://github.com/ROCSI-eu/warera-lab/actions/runs/37945476289) on 2026-10-09: full `npm run verify`, release-version consistency, formatting, lint (one non-blocking warning), production build, typecheck, 168 Vitest tests across 25 files and 136 Playwright cases. Release-documentation follow-up changes still require verification on the final PR head and a fresh Codex review before merge.
- Production deployment and smoke: **not performed**. Exact production commit, visible version, service health, live Player Lab and cross-lab verification remain pending separate deployment approval.
- Desktop, representative mobile, exact 320 px and reduced-motion browser evidence was captured through Playwright screenshot baselines and regression checks; no physical Android/iOS device checks are claimed.

### Known limitations

- Public current-state only: no private/authenticated data, historical progression, account storage, or player inventory tracking.
- Company output item is not a player-owned inventory balance. Ownership and reported worker/production values do not establish whether a company is active.
- Partial/missing upstream context remains unavailable rather than inferred. Market handoffs fetch current item data independently and do not revalidate a stale company-to-item association.
- Real-device mobile testing has not been performed as part of this candidate; automated mobile runs are browser emulation.
- The four-lab UX assessment (#93) and unified stabilization (#94) remain separate future work.

### References

- #45 — Player Lab MVP parent
- #95 — Player route, shell and snapshot lifecycle (PR #100)
- #96 — Public identity and economic profile (PR #101)
- #97 — Owned-company and output overview (PR #102)
- #98 — Contextual Economy, Company and Market handoffs (PR #103)
- #99 — Player Lab release-quality and versioning gate

## v0.0.6 — 2026-10-08

**Production commit:** `acd8749b6cce1301662840601f4ff5bff5c80de9`
**Previous version:** `v0.0.5`
**Environment:** Production — `https://warera-lab.rocsi.eu/`

### Summary

Delivers the Market Lab MVP alongside Economy Lab and Company Lab: a credential-free, current-state market explorer for item prices, orders, and transparent recipe-only economics, with deliberate handoffs to existing player/company scenario workflows.

### Added

- Dedicated Market Lab navigation and reload-safe item selection through the `lab=market&item=...` URL contract.
- Normalized, read-only current-market overview and selected-item API contracts behind the same-origin backend; browser-side WarEra credentials and direct external API requests are not required.
- Searchable item catalogue with available price, type, rarity, tradability, and explicit freshness/provenance information.
- Selected-item current top buy/sell orders, configured recipe inputs, current input/output prices, and clearly labeled derived recipe-only costs and implied spread with exact calculation disclosure.
- Deliberate Company Lab → Market Lab → Economy Lab handoffs carrying validated identities only; Economy Lab independently re-fetches its observed scenario baseline.
- Market Lab loaded/degraded visual baselines and responsive, reduced-motion, keyboard, accessibility, and cross-lab E2E release-gate coverage.

### Changed

- Current missing, empty, unavailable, partial-price, and upstream-rate-limit conditions are distinguished explicitly, with manual refresh and retry guidance instead of background polling.
- Release-candidate documentation now includes Market Lab workflow, privacy constraints, and the production smoke checklist.
- Automated accessibility coverage checks both loaded and degraded views and waits for independently loaded overview/item responses before scanning.

### Fixed

None.

### Verification

- Market Lab release-gate PR #88 merged into `main` as `10b7b834c7c6dfa860d784ae3dd4e1995c5e3059`.
- The final PR #88 head `fb53cac6a913cc4da8008b0a07e0b3475c2064cb` passed GitHub Actions full `npm run verify`: release-version consistency, formatting, lint, builds, typechecks, 147 Vitest tests, and 90 Playwright tests; final Codex review found no major issues.
- Release-preparation PR #89 final head `31c727db2d624bd97c7e13f9a59a681d77645ddc` passed [GitHub Actions run #37765155242](https://github.com/ROCSI-eu/warera-lab/actions/runs/37765155242) with `npm run verify` (release-version consistency, formatting, lint, production builds, typechecks, 147 Vitest tests and 90 Playwright tests). Final Codex review found no major issues.
- Release-preparation PR #89 merged to production commit `acd8749b6cce1301662840601f4ff5bff5c80de9`; both the tested PR head and the merged commit have the identical Git tree `5f60ca3c0e2a59c5c5ab270d9810163ca38cff81`.
- The exact merged commit was built and deployed on 2026-10-08. The production `current` symlink, root `VERSION`, `.deployment-sha` and visible frontend release agree on `v0.0.6` and that commit.
- Local and public `/api/health` checks passed; public root returned HTTP 200. Apache and `warera-lab-api.service` were active, with API service `NRestarts=0`.
- Public browser smoke passed on desktop (1440 px), representative mobile (390 px) and exactly 320 px. The 60-item current overview, selected steel item, orders, recipe-only economics, freshness and provenance rendered with Market overview/item API responses HTTP 200; no horizontal overflow, page/console errors, browser-side external requests or localStorage/sessionStorage/IndexedDB persistence were observed.
- Live `MihaiROCSI` public search/import and Economy Lab → Company Lab → Market Lab → Economy Lab handoffs passed at 320 px. Player/company context was preserved, selected market item data was not injected into the Economy Lab URL/scenario, and browser Back restored Market Lab. Observed browser API requests returned HTTP 200.
- Live loaded and degraded Market Lab views passed scoped Axe WCAG 2 A/AA, 2.1 A/AA and 2.2 AA checks at 320 px with reduced motion enabled, with zero reported violations and no horizontal overflow.
- The current v0.0.6 deployment retains v0.0.5 as the single rollback release.
- Tag `v0.0.6` resolves directly to the exact deployed commit `acd8749b6cce1301662840601f4ff5bff5c80de9`. [GitHub Release `v0.0.6 — Market Lab MVP`](https://github.com/ROCSI-eu/warera-lab/releases/tag/v0.0.6) was published on 2026-10-08, is marked Latest, and is neither draft nor prerelease.

### Known limitations

- Market Lab is current-state-only: no historical price tracking, continuous monitoring, automatic polling, alerts, watchlists, or authenticated/private game access.
- Recipe-only implied spread is not realized profit and does not assume undocumented game mechanics or business expenses.
- Missing current prices/configuration/order data remain unavailable rather than estimated.
- Player Lab and other future modules are not part of this release.

### References

- #44 — Plan and deliver Market Lab MVP
- #77 — Market Lab shell and URL-state contract
- #78 — Normalized current-state Market Lab API contract
- #79 — Current market overview and item explorer
- #80 — Transparent recipe-only current economics
- #81 — Market Lab cross-lab handoffs
- #82 — Final responsive, accessibility, E2E, and release gate
- PR #88 — Final Market Lab release-gate verification

## v0.0.5 — 2026-10-07

**Production commit:** `3db462a4c144bc3ad2214d116a186679e216e3c0`
**Previous version:** `v0.0.4`
**Environment:** Production — `https://warera-lab.rocsi.eu/`

### Summary

Completes the remaining Company Lab MVP work on top of the v0.0.4 snapshot overview. This release adds production and operating context, current market context, a deliberate Company Lab → Economy Lab handoff, production-availability guardrails for game features, and the final responsive/accessibility/E2E release gate.

### Added

- Company Lab production and operating context covering normalized production recipes, configured production points, current upgrade references, location references, and freshness/provenance.
- Company Lab current market context for the selected output and required recipe inputs, including current observed prices, recipe quantities, freshness, and explicit partial/unavailable states.
- **Model in Economy Lab** handoff that carries only player/company identity, reloads current normalized context, and establishes the intended selected company as the Economy Lab observed baseline.
- Minimal production-availability metadata for game features so production and development-only capabilities can be distinguished explicitly.
- Company Lab release-candidate visual coverage for desktop, representative mobile, exactly 320 px, reduced motion, and the real 12-company maximum portfolio.
- Cross-lab release-candidate documentation and feature-availability documentation.

### Changed

- Non-production/development-only upgrades are disclosed explicitly in company summaries and are not presented as valid production planning options.
- Company Lab duplicate-name selection, context switching, and Economy Lab handoff preserve exact company identity and refresh the matching normalized economy context.
- The estimated company-value copy is clearer about the value being an estimate rather than an observed market valuation.
- Company Lab responsive behavior, keyboard navigation, same-origin/privacy assertions, degraded-state recovery, and reduced-motion checks are now part of the formal release gate.
- The release checklist now validates the registered `/api/health` route and the 12-company maximum-portfolio boundary.

### Fixed

- Prevented development-only upgrade definitions from being treated as production-available planning capabilities.
- Removed ambiguous estimated-value wording that could overstate what the normalized snapshot represents.
- Hardened Company Lab context recovery and handoff verification against stale selection, loading-state, timing, and duplicate-company regressions.

### Verification

- The final Company Lab release-gate PR head `cadf87f1fcf16544b894cf9cd28f17fbe10e712e` and squash-merged main commit `d4600508094297d363704e190c648e67799dd63a` have the identical Git tree `916979e2fb374097a65f5fd90668b5c6178210c2`.
- GitHub CI run #102 passed on the final release-gate PR head with 116/116 Vitest tests and 56/56 Playwright tests.
- The focused 12-company maximum-portfolio journey passed on desktop and mobile.
- Company Lab representative and 12-company visual coverage passed across desktop, mobile, exactly 320 px, and reduced-motion projects, with no horizontal overflow at 320 px.
- Release-preparation PR #75 head `bacaae35413162cd37164d70d7ff0925a40fded7` passed GitHub CI run #104 with release consistency verified as `v0.0.5`, 116/116 Vitest tests, and 56/56 Playwright tests.
- The exact merged release commit `3db462a4c144bc3ad2214d116a186679e216e3c0` was built and deployed to production; `current`, root `VERSION`, `.deployment-sha`, and the visible frontend version all agree on `v0.0.5` and that SHA.
- Local and public `/api/health` checks passed, the public root returned HTTP 200, and `warera-lab-api.service` remained active with `NRestarts=0`.
- Live `MihaiROCSI` production smoke returned 9 companies; Company Lab selection and loaded operating/market context passed, and the Company Lab → Economy Lab handoff preserved the exact selected company identity.
- Exact 320 px production smoke measured `scrollWidth === clientWidth === 320`, with no horizontal overflow and no browser console/page errors observed during the smoke flow.
- Production `npm ci` reported 0 vulnerabilities.
- Tag `v0.0.5` resolves directly to production commit `3db462a4c144bc3ad2214d116a186679e216e3c0`, and GitHub Release `v0.0.5 — Company Lab MVP` is published as the repository's latest release.

### Known limitations

- Historical company analytics are not part of the Company Lab MVP.
- Continuous monitoring/alerts and authenticated/private War Era data remain out of scope.
- Market Lab and Player Lab remain future modules.

### References

- #43 — Plan and deliver Company Lab MVP
- #48 — Add Company Lab production and operating-constraint context
- #49 — Add current market context to Company Lab
- #50 — Add Company Lab to Economy Lab handoff
- #51 — Complete Company Lab responsive, accessibility, E2E, and release gate
- #69 — Track production availability and provenance for game features
- PR #68 — Clarify estimated company value copy

## v0.0.4 — 2026-10-06

**Production commit:** `d70736f349453fe3d4fa89bfee8994301d9f3e73`
**Previous version:** `v0.0.3`
**Environment:** Production — `https://warera-lab.rocsi.eu/`

### Summary

Delivers the first useful Company Lab company snapshot overview from the existing normalized public player snapshot. The selected company is now presented with its owner, output, geographic context, observed operations, active upgrades, optional estimated value, and the same freshness/provenance disclosure used by Economy Lab.

### Added

- Selected-company overview for Company Lab with owner/player context, output item, region/country, observed production, workers, active upgrades, and optional estimated value.
- Explicit calm unavailable states for missing normalized production, workforce, and geographic context.
- Focused server-render tests covering complete and partial normalized snapshots.
- Company Lab browser assertions for overview content, freshness disclosure, accessibility, and exact-320 px overflow behavior.

### Changed

- Snapshot freshness/provenance rendering is now a shared component reused by Economy Lab and Company Lab instead of a parallel Company Lab implementation.
- Company Lab copy now describes the available snapshot overview rather than the previous context-only foundation state.
- The Company Lab desktop grid gives the selected-company overview more room while preserving the existing compact mobile selector behavior and reload-safe URL contract.

### Fixed

None.

### Verification

- The exact PR head tree and squash-merged production commit tree were verified identical: `a164df45cb3245cd115a7e837926a91123860eac`.
- GitHub CI run #69 passed on PR head `ce9dfb56efd3e3a622300a6b970cfca22cd8119c` before merge.
- Local pre-merge verification passed: release consistency, formatting, lint, production build, typecheck, 108 Vitest tests, and 38 Playwright tests across desktop, mobile, exact-320, visual, reduced-motion, and accessibility coverage.
- Exact-SHA production deployment completed successfully from `d70736f349453fe3d4fa89bfee8994301d9f3e73`.
- Deployment metadata, the active release symlink, and root `VERSION` agree on the deployed SHA and `v0.0.4`.
- Local and public `/api/health` returned healthy responses; the public root returned HTTP 200.
- `warera-lab-api.service` remained active with `NRestarts=0`.
- Live `MihaiROCSI` regression returned 9 companies; the Company Lab overview rendered the selected company, normalized operations, upgrades, and snapshot provenance on desktop and exact 320 px.
- Selected Company Lab context survived reload at desktop and exact 320 px with zero horizontal overflow.
- Production install/build reported zero npm vulnerabilities.
- Tag `v0.0.4` was verified to resolve directly to production commit `d70736f349453fe3d4fa89bfee8994301d9f3e73`.
- GitHub Release `v0.0.4 — Company Lab company snapshot overview` was published and verified as the repository's latest release.

### Known limitations

- Production/operating-constraint interpretation remains scoped to #48.
- Current market context remains scoped to #49.
- Company Lab to Economy Lab handoff remains scoped to #50.
- The final Company Lab responsive/accessibility/E2E release gate remains scoped to #51.

### References

- #47 — Build the Company Lab company snapshot overview
- #43 — Plan and deliver Company Lab MVP

## v0.0.3 — 2026-10-06

**Production commit:** `139e5396d69f2045cb4dd8dd29a7ee457ae40242`
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

- Proposed PR tree `8a00db3680c3d4b03ae4152d1ae905c506e14da9` passed the complete `npm run verify` gate: release consistency, formatting, lint, production build, typecheck, 106 Vitest tests, and 38 Playwright tests.
- GitHub CI run #64 passed on PR head `c5b53cb94006e21990bea0d7e832f32dfd2c1f01` before merge.
- Squash-merged production commit `139e5396d69f2045cb4dd8dd29a7ee457ae40242` has the identical tested tree `8a00db3680c3d4b03ae4152d1ae905c506e14da9`.
- Post-merge GitHub CI run #65 passed on the exact production commit.
- Exact-SHA production deployment completed successfully from `139e5396d69f2045cb4dd8dd29a7ee457ae40242`.
- Deployment metadata, the active release symlink, and root `VERSION` agree on the deployed SHA and `v0.0.3`.
- Local and public `/api/health` returned healthy responses; the public root returned HTTP 200.
- `warera-lab-api.service` remained active with `NRestarts=0`.
- Live `MihaiROCSI` regression returned 9 companies; Company Lab preserved selected player/company context across reload at exact 320 px with zero horizontal overflow and without unnecessary Economy-context requests.
- Portable `#wl` scenarios remained detached from live identity: mixed live-context/scenario URLs canonicalized to the portable Economy Lab URL with zero live API requests.
- Production install/build reported zero npm vulnerabilities.
- Lightweight tag `v0.0.3` was verified to resolve directly to production commit `139e5396d69f2045cb4dd8dd29a7ee457ae40242`.
- GitHub Release `v0.0.3 — Multi-lab shell and Company Lab context` was published and verified as the repository's latest release.

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

[executed on device: wordpress-vm.europe-central2-a.c.rocsi-website-hosting.internal (cf7b7a3c-8ae4-4a25-9de1-9e3d5dde425e)]
