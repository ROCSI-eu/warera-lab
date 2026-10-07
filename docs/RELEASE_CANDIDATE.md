# WarEra Lab release-candidate smoke checklist

This checklist is the shared release gate for Economy Lab and Company Lab. It is intended to be run before deployment and then reused for the production smoke pass on the exact deployed commit.

## Automated release gate

Run from a clean checkout:

```bash
npm ci
npx playwright install chromium
npm run verify
```

A release candidate is not ready unless all of the following are green:

- Prettier formatting check;
- ESLint;
- package and application production builds;
- strict TypeScript checks;
- Vitest unit/integration/render tests;
- Playwright browser E2E on desktop and mobile;
- automated Axe accessibility checks;
- visual-regression checks for desktop, representative mobile, exactly 320 px, and reduced-motion modes.

## Economy Lab workflow

1. Search for a public player by name.
2. Select a result and import the normalized snapshot.
3. Confirm player, company, source timestamps, and textual freshness are visible.
4. Modify Scenario A and confirm Baseline remains unchanged.
5. Modify Scenario B and confirm Scenario A remains unchanged.
6. Compare Baseline → A, Baseline → B, and A → B.
7. Open **How is this calculated?** and verify versions, inputs, references, assumptions, overrides, and provenance are readable.
8. Export JSON and confirm source player identity is absent by default.
9. Opt in to source identity and confirm it appears only after the explicit choice.
10. Put the scenario in the `#wl=` URL fragment, reload, and confirm the scenario imports without a player lookup.
11. Refresh the same live player and confirm Scenario A/B hypotheticals survive while observed baseline/freshness updates.
12. Exercise rate-limit, upstream-unavailable, stale-data, empty-search, and malformed-share states and confirm the current usable workspace is not silently destroyed.

## Company Lab workflow

1. Enter Company Lab both from its navigation tab and from a direct `?lab=company&player=...&company=...` URL.
2. Reload a direct Company Lab URL and confirm player/company identity is restored.
3. Switch between companies and confirm the URL, pressed selection, overview, operating context, and market context move together.
4. With duplicate-name companies, confirm region/identity disambiguation prevents accidental selection of the wrong company.
5. Confirm the observed snapshot remains usable when normalized game configuration or market context is partial, unavailable, or rate-limited.
6. Confirm missing item/config/price values remain explicit and no replacement values are invented.
7. Activate **Model in Economy Lab** and confirm only player/company identifiers are carried by navigation.
8. Confirm Economy Lab reloads current public snapshot/config context and establishes its own observed baseline.
9. Confirm a stale/missing company ID recovers into a usable company selection instead of silently attaching the wrong company.
10. Use browser Back to return to the originating Company Lab context coherently.
11. Verify Company Lab introduces no browser-side external WarEra request and no server-persistence/account workflow.

## Responsive, accessibility, and visual checks

- Desktop workbench remains coherent at 1440 px.
- Representative mobile flow remains single-column and readable.
- At exactly 320 px, `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- Company selectors, lab navigation, handoff links, primary buttons, inputs, selects, textareas, scenario selectors, and disclosure controls are keyboard reachable.
- Visible focus is present for links, buttons, inputs, selects, and textareas.
- Forms and interactive controls have accessible names.
- Status, degraded-state, and validation messages use appropriate live/status or alert semantics.
- Freshness states are written as Live, Cached, or Stale and do not rely on colour alone.
- Provenance states are written as observed, overridden, assumed, or derived and do not rely on colour alone.
- Reduced-motion mode removes non-essential motion without removing functionality.
- Economy Lab and Company Lab full-page visual baselines are intentional and reviewed.
- The nine-company selector remains compact and unambiguous on desktop, mobile, and exactly 320 px.

## API, privacy, and persistence boundary

- Browser traffic for WarEra data uses only the same-origin `/api/*` boundary.
- Browser API traffic for direct Company Lab inspection is limited to the read-only same-origin player-snapshot and economy-context procedures. These browser-facing RPC endpoints use POST transport but do not persist state or perform in-game actions.
- No WarEra credential or token is requested from the user or exposed to the browser.
- Company Lab performs no in-game action.
- Scenario sharing is client-side only; there is no server persistence/account requirement.
- Company Lab navigation does not add local/session storage persistence.
- Unknown scenario fields are rejected by the strict parser.
- Source player identity is omitted from JSON/URL scenario sharing by default.
- Company Lab → Economy Lab navigation carries player/company identifiers, not raw snapshot/config data.

## Production deployment hand-off

Before deployment:

1. merge the release-gate changes and identify the exact resulting `main` SHA;
2. prepare the next deployment version and changelog entry according to [RELEASES.md](RELEASES.md);
3. run `npm run verify` on the exact commit intended for production;
4. deploy that exact tested commit;
5. verify `/api/health` and service health;
6. verify the visible application version and deployed SHA agree with the release record.

After deployment, smoke the public site using the same release candidate:

1. load the public home page and Economy Lab;
2. open Company Lab through navigation;
3. open/reload a direct Company Lab player/company URL;
4. select at least two companies where the player has multiple companies;
5. confirm Company Lab snapshot, operating/config context, market context, and freshness render without horizontal overflow;
6. activate **Model in Economy Lab** and confirm the intended company becomes the Economy Lab baseline;
7. use browser Back and confirm Company Lab context is restored;
8. repeat the core path on a representative mobile viewport;
9. confirm no unexpected browser-side external requests, persistence prompts, credentials, or account requirements appear;
10. record the production URL, deployed SHA, visible version, and smoke evidence in the release/issue record.

Issue #51 and parent #43 should remain open until this post-deploy production smoke is complete.
