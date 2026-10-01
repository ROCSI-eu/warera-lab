# Economy Lab release-candidate smoke checklist

This checklist is the hand-off gate from issue #31 to the isolated production deployment work in #20.

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
- automated Axe accessibility checks on the integrated workspace;
- visual-regression checks for desktop, representative mobile, 320 px, and reduced-motion modes.

## Browser workflow smoke check

Use the browser tests' deterministic same-origin fixtures or the isolated deployment once #20 exists.

1. Search for a public player by name.
2. Select a result and import the normalized snapshot.
3. Confirm the player, company, source timestamps, and textual freshness state are visible.
4. Modify Scenario A and confirm Baseline remains unchanged.
5. Modify Scenario B and confirm Scenario A remains unchanged.
6. Compare Baseline → A, Baseline → B, and A → B.
7. Open **How is this calculated?** and verify calculation versions, config revision, source timestamps, inputs, references, assumptions, overrides, and provenance are readable.
8. Export JSON and confirm source player identity is absent by default.
9. Opt in to source identity and confirm it appears only after the explicit choice.
10. Put the scenario in the `#wl=` URL fragment, reload the URL, and confirm the scenario imports without a player lookup.
11. Re-import/refresh the same live player and confirm Scenario A/B hypotheticals survive while the observed baseline/freshness updates.
12. Exercise rate-limit, upstream-unavailable, stale-data, empty-search, and malformed-share states and confirm the current usable workspace is not silently destroyed.

## Responsive and accessibility smoke check

- Desktop workbench remains coherent at 1440 px.
- Representative mobile flow remains single-column and readable.
- At 320 px, `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- Primary buttons, inputs, selects, textareas, scenario selectors, and disclosure controls are keyboard reachable.
- Visible focus is present for links, buttons, inputs, selects, and textareas.
- Forms and interactive controls have accessible names.
- Status and validation messages use appropriate live/status or alert semantics.
- Freshness states are written as Live, Cached, or Stale and do not rely on colour alone.
- Provenance states are written as observed, overridden, assumed, or derived and do not rely on colour alone.
- Reduced-motion mode removes non-essential motion without removing functionality.

## API/privacy boundary

- Browser traffic for WarEra data uses only the same-origin `/api/*` boundary.
- No WarEra credential or token is requested from the user or exposed to the browser.
- Scenario sharing is client-side only; there is no server persistence/account requirement.
- Unknown scenario fields are rejected by the strict parser.
- Source player identity is omitted from JSON/URL sharing by default.

## #20 deployment hand-off

Before production deployment:

- use the exact merged `main` SHA produced after #31;
- confirm `npm run verify` is green on that SHA;
- keep the initial deployment isolated at `warera-lab.rocsi.eu`;
- preserve the documented same-origin API boundary and adapter rate-limit coordination;
- do not introduce monetization UX while #9 remains unresolved;
- perform a post-deploy desktop/mobile smoke pass using this same checklist;
- record the production URL, deployed SHA, and smoke evidence in #20.
