# First Public MVP

**Status:** proposed for issue #6  
**Target:** first public release at `warera-lab.rocsi.eu`

## Product statement

The first WarEra Lab release should prove one clear workflow:

**Import → modify → compare → explain.**

A visitor searches for a WarEra player, imports a current public snapshot, explores the player's economy-related state, changes scenario inputs, and compares hypothetical outcomes without performing any in-game action.

The MVP is intentionally narrower than a general WarEra statistics site. Its first substantive workspace is **Economy Lab**.

## Product principles

1. **Credential-free by default.** No WarEra API token is required for the MVP.
2. **Documented API only.** The hosted service uses only procedures present in the official WarEra API documentation.
3. **Live state is not simulation.** API values are imported as observed inputs; WarEra Lab owns hypothetical calculations.
4. **Provenance is visible.** Values are marked as observed, derived, assumed, or overridden.
5. **No hidden formulas.** A calculation is exposed only when its mechanics are verified or the user explicitly provides the uncertain input.
6. **No in-game actions.** WarEra Lab does not work, fight, trade, hire, buy, sell, or otherwise act on a player's account.
7. **No account system in the MVP.** Scenarios are local/shareable rather than tied to a WarEra Lab login.
8. **No monetization-driven UX at launch.** Advertising and sponsorship remain disabled pending issue #9.

## Primary user journeys

### 1. Search and import a player

The homepage provides a prominent WarEra player/entity search.

The visitor can:

1. search by player name;
2. select the intended result;
3. open a public player snapshot;
4. see the snapshot timestamp and source freshness;
5. continue into Economy Lab with the imported state.

The snapshot may use the documented public procedures for search, public user profile, player companies, company details, regions/countries, game configuration, current equipment, and relevant market data.

No WarEra API token is requested.

### 2. Inspect the imported economy state

For an imported player, WarEra Lab presents economy-relevant information such as:

- player level and available/spent skill points;
- economy-related skills;
- owned companies;
- each company's product, region, observed production field, worker count, and active upgrade levels;
- relevant item recipes and production-point configuration;
- current public market-price references;
- relevant region/country context where it materially affects the scenario.

Data is not presented as a hidden raw API dump. The UI should surface only fields useful to the simulation or its explanation.

### 3. Build a scenario in Economy Lab

The Economy Lab contains three MVP modules.

#### A. Skill planner

The visitor can change the planned levels of economy-related skills:

- Production;
- Entrepreneurship;
- Management;
- Companies.

Using `gameConfig.getGameConfig`, WarEra Lab calculates:

- skill points required by the proposed allocation;
- skill points remaining or overspent;
- level-unlock eligibility;
- configured value at the current and proposed skill level;
- delta between current and proposed state.

The planner must not claim a downstream production/profit effect unless the formula linking that skill to the output has been independently verified.

#### B. Company and upgrade planner

For a selected company, the visitor can inspect and change planned levels of the company upgrades exposed in the public configuration, initially:

- Automated Engine;
- Storage;
- Break Room.

The documented game configuration currently exposes values such as:

- Automated Engine: `dailyProd`;
- Storage: `maxProduction`;
- Break Room: `maxWorkers` and `dailyHires`;
- upgrade steel and construction-point costs;
- upgrade timing/configuration where provided.

WarEra Lab calculates and compares:

- current versus proposed configured upgrade stats;
- steel cost of the planned change;
- construction-point cost of the planned change;
- configured capacity/daily-production/max-worker deltas;
- whether the selected level is present in the current official game configuration.

This module does not silently invent a formula combining upgrades, player skills, workers, region modifiers, or other factors into a final production number.

If a complete production formula is later verified, it can be added in a separate reviewed change with tests and provenance.

#### C. Market and margin simulator

The visitor can model profitability using live market references and explicit scenario assumptions.

WarEra Lab imports:

- current public item-price references;
- top current orders where useful;
- item recipes / production needs from the public game configuration;
- the selected company's output item.

The visitor can override:

- output sale price;
- input-resource price;
- quantity;
- optional labour/other cost entered manually;
- other explicitly labelled assumptions introduced by later verified mechanics.

The MVP calculates transparent arithmetic such as:

- gross revenue;
- recipe input cost;
- optional assumed costs;
- gross margin before unverified taxes/wage mechanics;
- margin per unit;
- break-even output price;
- delta versus the live-price baseline;
- scenario-to-scenario difference.

Taxes, worker productivity, fidelity effects, and other mechanics are included only after their calculation semantics are verified. Until then, they remain either excluded or explicit user-supplied assumptions.

### 4. Compare scenarios

The visitor can compare:

- **Current / baseline**
- **Scenario A**
- **Scenario B**

The comparison view shows only materially changed fields and key derived outputs.

Every result should preserve provenance, for example:

- **Observed** — live WarEra API value;
- **Derived** — calculated from verified configuration/arithmetic;
- **Assumed** — manually supplied because the game mechanic is not yet verified;
- **Overridden** — intentionally changed from the live/imported value.

### 5. Share or export a scenario

The MVP may provide a shareable URL and/or JSON export without server-side account storage.

By default, the share payload should contain:

- scenario inputs;
- calculation/config version;
- source snapshot timestamp where useful;
- no API credential;
- no private data;
- no browser/session identifier.

A player's username/account identifier should not be required to reproduce a pure scenario. If a future share feature includes the source player, that should be an explicit user choice rather than an invisible default.

## Public context views

The first release should include a small amount of public game context that directly helps Economy Lab rather than becoming a generic statistics portal.

### Market Explorer

A lightweight public market view can show:

- current item-price references;
- top public orders for a selected item;
- item recipe/configuration;
- timestamp/freshness;
- a shortcut to open that item in Economy Lab.

### Region/company context

Where relevant to an imported company, show:

- region name and current country;
- region development and documented public state used by the calculation;
- company item and active upgrades;
- relevant public configuration.

A standalone global country/battle dashboard is not required for this MVP.

## Required documented API surface

The MVP should be designed around the public procedures verified in #3, primarily:

- `search.searchAnything`
- `user.getUserLite`
- `user.getUserById`
- `company.getCompanies`
- `company.getById`
- `region.getById`
- `region.getRegionsObject`
- `country.getCountryById`
- `country.getAllCountries`
- `itemTrading.getPrices`
- `tradingOrder.getTopOrders`
- `workOffer.getWorkOffersPaginated` where useful as public context
- `upgrade.getUpgradeByTypeAndEntity`
- `gameConfig.getGameConfig`
- `gameConfig.getDates`
- `inventory.fetchCurrentEquipment` for the player snapshot / future Combat Lab hand-off

Not every procedure must be called for every page. Requests should be demand-driven, cached conservatively, deduplicated, and respectful of upstream rate limits.

## Explicit MVP exclusions

The following are **not** requirements for the first public release:

- WarEra API-token entry;
- token-gated worker details;
- token-gated transaction history;
- WarEra Lab user accounts;
- persistent private cloud scenarios;
- long-term player-history collection;
- continuous historical market/world scraping;
- undocumented/community-only API procedures;
- automated in-game actions;
- Combat Lab calculations;
- battle monitoring/dashboard functionality;
- full global statistics/rankings portal;
- recommendation engines that present an opaque "best" answer;
- advertising or paid sponsorship;
- paid tiers or feature paywalls.

These can be revisited through separate issues after the MVP establishes a reliable public-data and simulation foundation.

## Formula-verification rule

The simulator must not imply certainty where WarEra Lab has not established the underlying mechanic.

Before a game-specific formula is exposed as a derived result, it needs:

1. a documented source or reproducible direct-game/API evidence;
2. a written description of the formula and units;
3. fixtures covering realistic edge cases;
4. automated tests;
5. a provenance/version identifier so later game changes can be tracked.

Generic arithmetic such as revenue = quantity × price does not require a WarEra-specific formula investigation, but every WarEra-specific modifier does.

## Responsive UX

### Desktop

Prefer a workbench layout:

- player/company/scenario controls on the left;
- main outputs and scenario comparison in the central area;
- provenance/freshness/context details in a compact side or expandable panel.

### Mobile

Use a single-column flow:

1. imported snapshot summary;
2. scenario controls;
3. results;
4. comparison.

Important results should remain reachable without horizontal scrolling. Tables that cannot adapt should become cards or compact key/value comparisons.

Scenario controls should not rely on hover interactions.

## Freshness and failure states

Every live-data area should make freshness understandable.

The UI should:

- show when the upstream snapshot was retrieved;
- distinguish cached data from user overrides;
- provide a refresh action where appropriate;
- preserve the user's current hypothetical scenario if a refresh succeeds;
- fail gracefully when a WarEra endpoint is unavailable or rate-limited;
- never replace missing data with an invented value.

If upstream data is stale or unavailable, the simulator may continue with the last visible snapshot only when the UI clearly identifies that state.

## Accessibility and trust

The first release should target practical keyboard and screen-reader usability from the scaffold onward.

Provenance must not rely on colour alone. Badges/icons need text labels.

Every calculation result should offer a compact "How is this calculated?" explanation that identifies:

- source inputs;
- user overrides;
- formula/config version;
- assumptions;
- calculation timestamp.

## MVP success criteria

The MVP is ready for public release when a visitor can:

1. find and import a public WarEra player without credentials;
2. inspect economy-relevant player/company state;
3. plan economy-skill allocation using live game configuration;
4. model company upgrade changes using live configuration;
5. run a market/margin scenario with live price references and explicit overrides;
6. compare at least two hypothetical scenarios;
7. understand the provenance and freshness of every material output;
8. use the core workflow on both desktop and mobile;
9. share/export a scenario without leaking credentials or hidden user data;
10. encounter no dependency on undocumented or token-gated endpoints.

## Implementation hand-off

After this specification is accepted:

- issue #5 should select the minimum architecture required to implement these journeys;
- implementation should be split into small issues/PRs for API normalization, simulation core, player search/snapshot, Economy Lab modules, scenario comparison, share/export, responsive UI, and production deployment;
- Combat Lab and historical-data collection should receive separate post-MVP planning issues rather than expanding the first release.
