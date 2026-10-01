# WarEra API Capability Audit

**Snapshot date:** 2026-10-01  
**Tracking issue:** #3  
**Primary source:** official WarEra API documentation at <https://api2.warera.io/docs/>

This document records what the official API documentation exposes today and a small set of direct, low-volume runtime checks against the live API. It is a discovery artifact, not a guarantee that WarEra will keep any procedure, response shape, limit, or field unchanged.

## Executive findings

The official Swagger/OpenAPI bundle currently identifies itself as:

- OpenAPI **3.0.0**
- WarEra API version **0.17.4-beta**
- **40 documented procedures**
- server path: `/trpc`

This corrects an earlier exploratory assumption that the official API surface contained roughly 80 procedures. Community clients and explorers expose additional procedures, but they are **not part of the current official documented surface** and must not be treated as official API capability.

The official specification models the operations as `POST` entries for Swagger purposes, while its own description explicitly says that every API call is made with **GET**. Direct testing confirmed GET requests against `https://api2.warera.io/trpc/<procedure>`.

The live tRPC input format observed during this audit is a URL query parameter containing the procedure input directly as JSON:

`?input={"searchText":"test"}`

The `{"json": ...}` wrapper used by some tRPC configurations was rejected for procedures with required fields and should not be assumed here.

## Authentication and rate-limit observations

The OpenAPI document currently declares **no global security requirement and no security scheme**. That omission must not be interpreted as meaning every documented procedure is anonymous.

A low-volume anonymous pass showed:

- most documented read procedures are reachable without an API token;
- `transaction.getPaginatedTransactions` returned **401 / API token required**;
- `worker.getWorkers` returned **401 / API token required**;
- `worker.getTotalWorkersCount` returned **401 / API token required**;
- procedures tested with a syntactically valid but nonexistent entity returned normal **404 / NOT_FOUND**, rather than an authentication failure, which indicates that the route itself is anonymously reachable.

Anonymous responses during the audit included these headers:

- `ratelimit-limit: 100`
- `ratelimit-policy: 100;w=60`
- `ratelimit-remaining: <dynamic>`
- `ratelimit-reset: 60`

This is an **observed runtime limit on 2026-10-01**, not a contractual entitlement. WarEra Lab should read and respect server-provided rate-limit headers rather than hard-code 100 requests/minute as a permanent rule.

## Capability matrix

Legend:

- **Public observed** — successful anonymous request was observed.
- **Public route observed** — anonymous access reached normal procedure handling, but the sample entity was absent.
- **Token required** — anonymous request returned 401 with `API token required`.
- **P0** — likely required for the first useful simulation MVP.
- **P1** — useful near-term context or follow-up capability.
- **P2** — not needed for the first simulator release.

| Procedure | Key documented inputs | Anonymous observation | WarEra Lab relevance | Priority |
| --- | --- | --- | --- | --- |
| `company.getById` | `companyId*` | Public observed | Company state for economic scenarios | P0 |
| `company.getCompanies` | `userId`, `perPage`, `cursor` | Public observed | Import a player's company IDs; resolve details with `company.getById` | P0 |
| `country.getCountryById` | `countryId*` | Public observed | Country context, taxes/resources | P1 |
| `country.getAllCountries` | none | Public observed | Country lookup and global context | P1 |
| `event.getEventsPaginated` | `limit`, `cursor`, `countryId`, `eventTypes` | Public observed | World/history context | P2 |
| `government.getByCountryId` | `countryId*` | Public observed | Country/government context | P2 |
| `region.getById` | `regionId*` | Public observed | Region/deposit/production context | P0 |
| `region.getRegionsObject` | none | Public observed | Region lookup and production geography | P0 |
| `battle.getById` | `battleId*` | Public observed | Battle context | P1 |
| `battle.getLiveBattleData` | `battleId*`, `roundNumber` | Public observed | Live battle state | P1 |
| `battle.getBattles` | filters, pagination | Public observed | Battle discovery | P1 |
| `round.getById` | `roundId*` | Public observed | Round detail | P1 |
| `round.getLastHits` | `roundId*` | Public observed | Combat observations | P1 |
| `battleRanking.getRanking` | battle/round/war filters, `dataType*`, `type*`, `side*` | Public observed | Combat benchmarking | P1 |
| `itemTrading.getPrices` | none | Public observed | Current item prices for scenario valuation | P0 |
| `tradingOrder.getTopOrders` | `itemCode*`, `limit` | Public observed | Market depth/best current orders | P0 |
| `itemOffer.getById` | `itemOfferId*` | Public route observed; sample item absent | Individual offer detail | P2 |
| `workOffer.getById` | `workOfferId*` | Public observed | Work-offer detail | P1 |
| `workOffer.getWorkOfferByCompanyId` | `companyId*` | Public route observed; sample company had no offer | Company wage context | P1 |
| `workOffer.getWorkOffersPaginated` | user/region filters, energy, production, level, citizenship, pagination | Public observed | Wage/work-market scenarios | P0 |
| `ranking.getRanking` | `rankingType*` | Public observed | Global/player/country/MU comparison | P1 |
| `search.searchAnything` | `searchText*` | Public observed | Primary entity/player search | P0 |
| `gameConfig.getDates` | none | Public observed | Game timing / freshness context | P0 |
| `gameConfig.getGameConfig` | none | Public observed | Authoritative game constants/configuration | P0 |
| `user.getUserLite` | `userId*` | Public observed | Player skills/rankings import | P0 |
| `user.getUsersByCountry` | `countryId*`, pagination | Public observed | Country/player discovery | P2 |
| `user.getUserById` | `userId*` | Public observed | Public player profile import | P0 |
| `article.getArticleById` | `articleId*` | Public observed | Article/context tools | P2 |
| `article.getArticleLiteById` | `articleId*` | Public observed | Lightweight article metadata | P2 |
| `article.getArticlesPaginated` | `type*`, filters, pagination | Public observed | News/community context | P2 |
| `mu.getById` | `muId*` | Public observed | Military-unit context | P2 |
| `mu.getManyPaginated` | filters, pagination | Public observed | MU discovery | P2 |
| `transaction.getPaginatedTransactions` | filters, pagination | **Token required** | Historical/economic transaction analysis | P1 |
| `upgrade.getUpgradeByTypeAndEntity` | `upgradeType*` + region/company/MU entity | Public observed | Company/region upgrade state | P0 |
| `worker.getWorkers` | `companyId` or `userId` | **Token required** | Worker-level company simulation | P1 |
| `worker.getTotalWorkersCount` | `userId*` | **Token required** | Aggregate worker state | P1 |
| `battleOrder.getByBattle` | `battleId*`, `side*` | Public observed | Battle orders/context; text/rank can be membership-restricted | P2 |
| `battleLootSummary.getByBattleAndUser` | `battleId*`, `userId*` | Public route observed; sample summary absent | Combat outcome analysis | P1 |
| `inventory.fetchCurrentEquipment` | `userId*` | Public observed | Player equipment import for Combat Lab | P0 |
| `mercenaryContractAuction.getPaginatedAuctions` | country/battle/status filters, pagination | Public observed | Mercenary/battle economy context | P2 |

`*` = documented required field.

## Documented enum/value surfaces relevant to simulation

The official documentation currently exposes several useful enumerations rather than leaving them to guesswork:

- battle ranking data types: `damage`, `points`, `money`;
- battle ranking entity types: `user`, `country`, `mu`;
- battle sides: `attacker`, `defender`, `merged`;
- upgrade types include `bunker`, `base`, `pacificationCenter`, `storage`, `automatedEngine`, `breakRoom`, `headquarters`, `dormitories`;
- ranking types cover country, user, MU and alliance metrics;
- event types cover wars, battles, elections, region transfers, deposits, alliances, revolts, unrest and resource reshuffles.

These should be generated or normalized from the official contract where practical rather than duplicated as undocumented literals.

## What the official surface enables for the first product

A useful credential-free first release appears feasible.

### Player import

A 2026-10-01 runtime check confirmed that `company.getCompanies` currently returns company identifiers in its `items` array, not embedded company-detail objects. Company details therefore require documented `company.getById` calls. WarEra Lab normalizes this distinction internally rather than exposing the raw list shape to browser code.

The public documented surface can resolve entities and import:

- public player profile and skills;
- current equipment;
- player-owned companies through company filtering;
- relevant region/country context;
- public rankings.

This supports a strong "search player → import live snapshot → modify scenario" flow without requiring visitors to hand WarEra Lab an API token.

### Economy Lab

The documented public surface provides:

- companies;
- regions and countries;
- current item prices;
- top trading orders;
- public work offers;
- upgrade state;
- game configuration.

The first economic simulator should be designed around those **documented** inputs.

Worker-level details and transaction history are token-gated, so they should not be prerequisites for the default public MVP. They can be introduced later as an optional authenticated enhancement if #4 confirms a safe credential model.

### Combat Lab

Public profile, current equipment, battle, round, hit and ranking procedures provide a useful observational base for later combat modelling. The API still does not itself constitute a combat simulator: formulas and assumptions must be independently documented and provenance-labelled.

## Important exclusions

Community projects currently reference procedures that do not appear in the official 0.17.4-beta documentation, including examples such as production-bonus and work-stat endpoints.

WarEra Lab should **not build production functionality around undocumented procedures** merely because third-party clients can call them. Issue #4 separately reviews the current Terms of Use and API boundaries; until that review is complete, undocumented/internal endpoints are out of scope.

This also means earlier product discussion that assumed access to community-discovered procedures must be revalidated against this 40-procedure official surface.

## Runtime test method

The anonymous verification pass was deliberately small:

- one or a few representative calls per documented procedure;
- no account token;
- no attempt to bypass access controls;
- no undocumented procedures;
- no high-volume pagination;
- request volume kept below the server-provided rate limit.

A successful anonymous call proves only that the tested route and input were publicly reachable at the time of the test. It does not prove that every field is stable, that every combination of inputs is public, or that WarEra will preserve the same access policy.

## Follow-up

Issue #4 should determine the policy/terms implications of:

- authenticated API tokens;
- caching;
- historical storage;
- redistribution and public display;
- third-party/user-created content;
- rate-limit compliance;
- whether any additional explicit permission is needed for the intended hosted service.

Issue #6 should use this audit to define an MVP that depends only on supported, documented capabilities.