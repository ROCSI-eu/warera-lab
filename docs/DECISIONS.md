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

## Working directions, not yet final

- Core simulation functionality is expected to remain free and publicly accessible.
- Monetization may later use restrained advertising, sponsorship, or voluntary support rather than feature paywalls.
- Historical market/world datasets may become a distinct hosted capability if their storage and maintenance cost becomes material.
- The canonical ROCSI-hosted service should be deployable independently from the main `rocsi.eu` website.

These directions require separate product, privacy, and architecture review before implementation.

## Open questions

The following should not be treated as settled:

- application framework and monorepo/package structure;
- backend/runtime choice;
- API proxy versus direct-browser access boundaries;
- WarEra API-key handling and whether account-specific functionality is needed for MVP;
- caching policy and rate-limit strategy;
- persistent database requirements;
- historical-data collection scope;
- exact Economy Lab MVP;
- exact Combat Lab mechanics and formula verification;
- user accounts or saved scenario storage;
- advertising provider and EU consent/CMP implications;
- production deployment topology and observability.

Each material decision should be resolved through an issue and pull request or an ADR before becoming implementation policy.
