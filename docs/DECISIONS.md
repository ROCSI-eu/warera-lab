# Project Decisions

This document records decisions that are already agreed for WarEra Lab and separates them from questions that still require analysis.

## Confirmed

### D-001 — Project identity

- Product name: **WarEra Lab**
- Repository: `ROCSI-eu/warera-lab`
- Planned canonical public deployment: `warera-lab.rocsi.eu`
- Repository visibility: **public**

### D-002 — Licensing

WarEra Lab software is released under **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**.

The project should remain inspectable, forkable, self-hostable, and modifiable while preserving source availability for modified network-hosted versions under the AGPL.

### D-003 — Independence

WarEra Lab is an independent community tool and must not present itself as an official WarEra property.

### D-004 — API source hierarchy

For WarEra API capabilities:

1. official WarEra API documentation is the primary reference;
2. direct live API inspection is used to verify actual runtime behavior, response shapes, limits, and errors;
3. maintained clients and community documentation may supplement the official reference;
4. assumptions or reverse-engineered mechanics must be labelled as such until verified.

### D-005 — Live state versus simulation

The WarEra API provides observed/current game state. WarEra Lab performs hypothetical calculations locally or in its own services.

A simulation must not be confused with an in-game action.

### D-006 — Provenance

User-visible results should distinguish:

- observed data;
- derived calculations;
- assumptions;
- user overrides.

This provenance should survive scenario comparison and, where practical, exported/shared simulations.

### D-007 — First public MVP

The first public release is **credential-free and Economy-Lab-first**.

It should provide:

- public player search/import;
- economy-relevant player/company snapshot;
- economy skill planning from live game configuration;
- company upgrade planning from live game configuration;
- market/margin scenarios with explicit overrides;
- side-by-side scenario comparison;
- provenance, freshness, and share/export behavior without server-side user accounts.

Token-gated worker/transaction features, Combat Lab calculations, persistent player history, continuous historical collection, and generic global-statistics dashboards are outside the first MVP.

See [MVP.md](MVP.md).

### D-008 — Formula verification

WarEra-specific derived calculations must not be exposed as authoritative until their mechanics and units are verified, documented, versioned, and tested.

Where a mechanic is not verified, WarEra Lab should either omit the derived result or require the uncertain value as an explicit user assumption/override.

### D-009 — Launch monetization

The canonical WarEra Lab service launches without advertising or sponsorship.

Commercial-use, advertising, sponsorship, donation/support, caching, and historical-dataset permissions remain subject to clarification tracked in issue #9. This does not change the AGPL-3.0-only licence of the WarEra Lab software.

### D-010 — Initial application architecture

The first implementation uses:

- Node.js 22 and npm workspaces;
- a static Vite + React web application served by Apache;
- a small Hono API service bound to loopback and exposed only through same-origin `/api/` routing;
- `domain`, `warera-api`, and `simulation-core` workspace packages;
- server-side access to the official documented WarEra API rather than browser-direct upstream calls;
- a bounded in-memory operational cache with no Redis/database dependency for the MVP;
- browser-local/shareable scenario state rather than server-side user accounts;
- a dedicated future production systemd service and Apache virtual host, isolated from existing ROCSI services.

Raw WarEra responses stop at the API normalization boundary. Simulation logic remains pure TypeScript with no network or storage dependencies.

See [ADR 0001](adr/0001-initial-architecture.md).

## Working directions, not yet final

- Core simulation functionality is expected to remain free and publicly accessible.
- Historical market/world datasets may become a distinct hosted capability only after the API/terms/privacy questions are resolved.
- The canonical ROCSI-hosted service should be deployable independently from the main `rocsi.eu` website.

These directions require separate product, privacy, and architecture review before implementation.

## Open questions

The following should not be treated as settled:

- exact per-endpoint cache TTLs and rate-limit safety-reserve tuning;
- optional post-MVP API-token handling for authenticated features;
- historical-data collection scope;
- exact post-MVP Combat Lab mechanics;
- post-MVP user accounts or saved scenario storage;
- monetization provider / EU consent implications if issue #9 later permits advertising or sponsorship;
- final production release paths, service naming, monitoring, and operational runbooks.

Each material decision should be resolved through an issue and pull request or an ADR before becoming implementation policy.
