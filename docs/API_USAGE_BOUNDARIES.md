# WarEra API Usage Boundaries

**Snapshot date:** 2026-10-01  
**Tracking issue:** #4

This document records the current operational boundaries for WarEra Lab based on War Era's published Terms of Use, Privacy Policy, official API documentation, and low-volume live API observations.

It is an engineering/compliance decision record, not legal advice.

## Primary published sources

- War Era Terms of Use: <https://app.warera.io/terms>
- War Era Privacy Policy: <https://app.warera.io/privacy>
- Official API documentation: <https://api2.warera.io/docs/>

The Terms of Use and Privacy Policy inspected for this review both state an effective date of **2026-09-28**.

## Core conclusion

A public WarEra Lab that uses the **documented public API** for transparent, low-volume simulation and analysis appears compatible with the published rules **provided we stay within the documented API, authentication rules, rate limits, technical restrictions, data-protection obligations, and other published conditions**.

The Terms explicitly permit scripts and applications to use the public documented API subject to those constraints.

That permission is not a general licence to scrape or mirror War Era.

## Documented API only

The Terms prohibit using tools, developer utilities, command-line programs, or custom scripts to access internal/non-public interfaces or to obtain functionality or data beyond what the public API and documented endpoints are intended to provide, unless War Era has given prior written authorisation.

### WarEra Lab policy

Until written permission says otherwise:

- production code may call only procedures present in the current official API documentation;
- community-discovered or reverse-engineered endpoints are not production dependencies;
- undocumented endpoints may be mentioned in research notes only as external/community observations, not called by the hosted service;
- if an officially documented procedure disappears, it should fail closed and be reviewed rather than replaced automatically by an undocumented equivalent.

This directly affects earlier exploratory ideas involving community-only procedures such as production-bonus or work-stat endpoints.

## Rate limits and technical safeguards

The Terms prohibit circumventing:

- rate limits;
- quotas;
- authentication;
- access controls;
- pagination safeguards;
- other technical protections.

They specifically prohibit avoiding limits by rotating accounts, API tokens, devices, proxies, or IP addresses.

Live anonymous responses observed on 2026-10-01 included:

- `ratelimit-limit: 100`
- `ratelimit-policy: 100;w=60`
- `ratelimit-reset: 60`

Those values are runtime observations, not guaranteed entitlement.

### WarEra Lab policy

- read and respect server-provided rate-limit headers;
- add an internal safety margin rather than consuming the published ceiling;
- use deduplication and bounded caching to reduce repeat requests;
- do not rotate identities, hosts, proxies, or tokens to obtain more capacity;
- do not use a third-party gateway **for the purpose of bypassing War Era limits**;
- if traffic grows beyond what direct compliant access can sustain, seek explicit permission or a supported higher-capacity arrangement rather than engineering around the restriction.

## Public versus authenticated API data

War Era's Privacy Policy explicitly describes a public API.

It states that unauthenticated public API responses may contain detailed public profile and gameplay information, including activity dates, progression, skills, statistics, rankings, equipment, roles, and other multiplayer information.

The Privacy Policy also states that authenticated API functionality may use API tokens associated with a user's account and that API tokens should be treated as credentials and provided only to applications the user trusts.

The official OpenAPI document currently declares no security scheme, so authentication requirements must be verified at runtime procedure by procedure.

The 2026-10-01 audit observed three documented procedures returning `401 API token required` anonymously:

- `transaction.getPaginatedTransactions`
- `worker.getWorkers`
- `worker.getTotalWorkersCount`

See [API_AUDIT.md](API_AUDIT.md) once #3 is merged for the complete procedure audit.

## API-token handling

WarEra Lab's first public MVP should **not require an API token**.

The documented anonymous surface is already sufficient for a meaningful player import and initial simulation experience.

If token-backed features are introduced later, they require a dedicated security/privacy design.

Minimum requirements should include:

- explicit explanation of why the token is needed;
- no token in URLs, analytics, telemetry, shared scenarios, exports, screenshots, client error reports, or application logs;
- no persistent server-side token storage by default;
- no token reuse for purposes unrelated to the feature the user invoked;
- clear removal/revocation guidance;
- strict separation between one user's credentialed data and every other user's cache/session;
- a threat model for browser storage, server transit, proxy logs, and support/debug workflows.

Whether direct browser-to-WarEra calls or a narrowly scoped ROCSI proxy is preferable is an architecture decision for #5, not something this document settles.

## Personal data and public profiles

The Privacy Policy makes clear that public API data can still include personal data or player-linked information.

War Era identifies public categories including usernames/account identifiers, profile information, activity dates, progression, skills, rankings, equipment, affiliations, gameplay activity, and other multiplayer information.

War Era also states that certain non-public data is not exposed through the public API, including email addresses, phone data, IP addresses, security signals, payment-card details, and private support correspondence.

### WarEra Lab policy

Public availability does not eliminate our own privacy responsibilities.

For the MVP:

- fetch only fields needed for the requested simulation or display;
- avoid building hidden behavioural profiles;
- avoid indefinite player-level history;
- avoid correlating WarEra data with unrelated external identities;
- do not infer or reconstruct information the API does not intend to expose;
- make provenance and snapshot timestamps visible;
- design caches around short-lived current-state use rather than surveillance-style retention.

Any later persistent historical dataset containing player-linked data needs its own privacy review.

## Storage, redistribution, and historical datasets

The Terms state that retrieving information through the public API does not mean War Era owns that content or that the content is free from third-party rights or data-protection obligations.

They also restrict, unless expressly permitted by API documentation or applicable law:

- systematic extraction;
- mirroring;
- reproduction or republication of substantial quantities of user-created or third-party content;
- datasets built for purposes inconsistent with the documented API;
- harvesting personal data for harassment, profiling, or deanonymisation;
- attempts to infer non-public information.

### WarEra Lab policy

For the MVP:

- short operational caches are acceptable as an efficiency mechanism, subject to normal privacy/security controls;
- do not mirror articles or large bodies of user-generated content;
- do not bulk archive player profiles;
- do not launch a continuous historical-scraping worker;
- do not treat API availability as a licence to republish all retrieved data.

A future historical market/world dataset may still be possible, particularly for non-user-generated aggregate/current-market facts, but scope, retention, redistribution, and collection cadence need separate review and potentially clarification from War Era before implementation.

## Open-source repository and War Era assets

The WarEra Lab source code can remain open source under AGPL-3.0-only.

However, the software licence does not grant us rights to redistribute War Era's protected logos, artwork, interfaces, game assets, or user-created content.

### Repository policy

- do not copy War Era artwork/logo assets into the repository without documented permission;
- use factual textual references needed for interoperability and attribution;
- keep the independent/non-affiliated notice visible;
- keep sample/test fixtures synthetic or minimal where practical;
- do not commit API-token values or private account data.

## Monetization and advertising

This area is **not sufficiently clear for us to treat advertising as pre-approved**.

The Terms state that War Era content may be used only as permitted by the Terms, Rules, API documentation, other licence, and applicable law, and that War Era content may not otherwise be commercially exploited without prior written permission.

The current official API documentation does not appear to grant an explicit commercial-use licence.

That does **not necessarily mean that an independent tool displaying limited API data with ads is prohibited**, but it does mean WarEra Lab should not assume that conclusion on its own.

### WarEra Lab policy

At launch:

- keep the canonical service ad-free;
- do not sell War Era data;
- do not place paid ranking or influence mechanisms into simulations;
- do not make monetization a prerequisite for the first release.

Before enabling programmatic ads, direct sponsorship attached to WarEra Lab, or paid data/API products, seek explicit clarification from War Era about commercial use of the public API and displayed game data.

Voluntary support for ROCSI/open-source development should also be reviewed in that clarification if it is presented directly on the WarEra Lab service.

## Third-party gateways

Community gateways can provide useful caching and aggregation, but they introduce two concerns:

1. WarEra Lab would be depending on a third party for data correctness and availability.
2. A gateway must not be used as a mechanism to circumvent War Era's own rate limits or access controls.

### WarEra Lab policy

The canonical ROCSI deployment should use the official documented API directly unless War Era explicitly recommends or approves another route.

Community gateways can remain useful references for ecosystem research, but they should not be a hidden production dependency in the MVP.

## Recommended go / hold boundaries

### Go

- documented public API procedures;
- anonymous player/public-state import;
- current-state economic/combat inputs;
- local hypothetical simulation;
- transparent scenario comparison;
- bounded, short-lived caching;
- direct official-API access with rate-limit compliance;
- open-source code and synthetic/minimal fixtures.

### Hold pending design/review

- user-supplied API tokens;
- token-gated worker/transaction features;
- persistent player history;
- continuous historical collection;
- broad republication of retrieved content;
- advertising, sponsorship, or commercial API/data products;
- third-party gateway dependency.

### Do not do without explicit written authorisation

- undocumented/internal endpoint access;
- rate-limit or access-control circumvention;
- rotating tokens/proxies/IPs to obtain additional capacity;
- attempting to infer non-public data;
- bulk mirroring of user-created content contrary to the published conditions.

## Architecture consequences

Issues #5 and #6 should proceed on these assumptions:

1. The default MVP is credential-free.
2. The official API is the canonical upstream.
3. The API adapter must expose rate-limit metadata to the application.
4. Cache design should reduce upstream load, not create a bulk data mirror.
5. Simulation engines should consume normalized snapshots, not raw API responses.
6. Unsupported/undocumented data should become an explicit user input or derived/assumed value, not trigger hidden endpoint discovery.
7. Historical storage and monetization remain separate post-MVP decisions.

## Remaining clarification worth seeking from War Era

A concise written clarification would materially reduce uncertainty around:

- whether advertising or sponsorship on a public third-party API tool is permitted;
- whether donations/support links on such a tool are treated differently;
- acceptable caching duration for public API responses;
- acceptable retention of aggregate market/world snapshots;
- whether long-term non-personal historical datasets are permitted;
- whether War Era has a preferred authentication pattern for third-party apps;
- whether there is an official contact/process for registering or reviewing community API tools.

Until clarified, WarEra Lab should use the conservative boundaries above.
