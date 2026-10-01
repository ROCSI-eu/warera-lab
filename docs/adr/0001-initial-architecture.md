# ADR 0001: Initial application architecture

- **Status:** Accepted
- **Date:** 2026-10-01
- **Decision issue:** #5

## Context

WarEra Lab's first public MVP is credential-free, Economy-Lab-first, and limited to the documented WarEra public API. The API audit in `docs/API_AUDIT.md` verified a useful anonymous surface and observed upstream rate-limit headers. The usage-boundary review in `docs/API_USAGE_BOUNDARIES.md` requires us to stay on documented endpoints, respect rate limits and access controls, avoid bulk mirroring, and keep API-token functionality out of the MVP. The product scope in `docs/MVP.md` requires transparent provenance and local what-if simulation rather than in-game actions.

The ROCSI production VM currently runs Node.js 22 and Apache 2.4, has existing services on loopback ports 3200 and 3210, and has enough available memory to add a small isolated service. We should minimize the new service's blast radius and recurring infrastructure cost.

## Decision

### Runtime and repository

Use a TypeScript monorepo with **npm workspaces** and a **Node.js 22** runtime baseline. The repository is split into:

```text
apps/
  web/               Vite + React browser application
  api/               Hono HTTP service on Node.js
packages/
  domain/            canonical shared models and provenance types
  warera-api/        official-API adapter and normalization boundary
  simulation-core/   pure deterministic simulation logic
```

The packages are private workspace packages for now; open-source availability comes from the repository and AGPL-3.0-only licence, not npm publication.

### Web application

Use **React 19 with Vite 8**. The production web build is static and is served directly by Apache. This keeps ordinary page and asset delivery out of the Node process and leaves the shared VM with a smaller always-on memory footprint than a full server-rendered framework would require.

Routing, query-state tooling, and the visual component system can be introduced when the first functional screens require them; they are not necessary to prove the scaffold.

### Same-origin API service

Use **Hono on Node.js** for a small API service. The service binds only to `127.0.0.1`; the initial configurable port is **3220**, which is currently unused on the shared VM. Apache will proxy only `/api/` to this process. All other requests remain static-file traffic.

The browser communicates only with WarEra Lab's same-origin `/api/` surface. **The browser does not call the WarEra API directly in the MVP.**

This boundary gives us one place to:

- normalize unstable/raw upstream response shapes;
- validate responses before they reach simulation code;
- deduplicate and cache upstream requests;
- observe and respect upstream rate-limit headers;
- normalize upstream failures;
- avoid relying on WarEra CORS behavior;
- avoid exposing upstream implementation quirks throughout the React application.

Client-facing search/simulation API operations should prefer JSON request bodies rather than putting player-search text or scenario inputs into access-log query strings. API responses default to `Cache-Control: no-store`; short operational caching happens inside our service, not in shared intermediary caches.

### WarEra API normalization boundary

`packages/warera-api` is the only package allowed to know raw WarEra procedure names and raw response shapes. It will:

1. call only officially documented procedures;
2. validate the subset of upstream responses we use;
3. map those responses into canonical domain models;
4. attach retrieval/rate-limit metadata;
5. never silently fill missing upstream values with invented defaults.

The web application and simulation engine consume canonical models, not raw tRPC payloads. Runtime validation will be implemented with a schema library in the first adapter PR; it is intentionally not added unused in the scaffold.

### Simulation boundary

`packages/simulation-core` contains pure TypeScript. It has no network access, storage access, DOM dependency, clock dependency, or framework dependency. A simulation receives a normalized snapshot plus explicit scenario inputs and returns deterministic results with provenance.

This allows the same formulas to be unit-tested independently and reused by the browser or a future worker/service if necessary. WarEra-specific formulas remain gated by the verification rules in `docs/MVP.md`.

### Caching and rate limits

The MVP does **not** add Redis, a database, or persistent cache storage. The API service will use a bounded in-memory cache with request coalescing once upstream integration begins. Cache entries disappear when the service restarts.

Cache policy is endpoint-specific and conservative. The initial implementation uses a hard bound of 256 entries and short, configurable defaults: 10 seconds for player/search/company state, 30 seconds for region/country context, 5 seconds for aggregate market prices, 3 seconds for top orders, and 60 seconds for game configuration. Stale-if-error is disabled for player/search/company/order data and is limited to short explicit windows for region/country context, market prices, and game configuration. Every response reports whether its data was a cache miss, fresh cache hit, or explicitly stale fallback, together with age and policy metadata. These defaults remain configurable and will be reviewed when issue #9 clarifies acceptable caching expectations.

Identical in-flight requests are coalesced. Every upstream response's rate-limit headers are treated as runtime truth. The adapter keeps a configurable safety reserve (initial default: 5 requests), accounts for concurrent upstream work, and holds new uncached requests when the observed remaining budget reaches that reserve. Cached data can still be served without consuming upstream budget; eligible stale data may be used only inside its configured stale-if-error window. The service never rotates tokens, IPs, proxies, or hosts to evade limits.

### Persistence and sharing

No database is required for the first MVP.

Scenario state remains in the browser. Shareable scenarios should use a versioned, client-side payload (preferably URL fragment and/or exported JSON) so the server does not need to store user scenarios. API credentials are not part of the MVP and therefore cannot appear in a share payload.

A persistent database becomes a separate architecture decision only if later requirements genuinely need accounts, server-side scenario storage, or permitted historical datasets.

### Testing

The baseline test layers are:

- **unit tests** for `simulation-core`;
- **adapter/normalization tests** with minimal synthetic fixtures when WarEra API integration is added;
- **API route tests** for same-origin service behavior;
- **frontend component tests** when interactive screens begin;
- **browser E2E/visual tests** before the first public production release.

Real player responses should not become long-lived fixtures when synthetic/minimized fixtures can exercise the same contract.

### CI

GitHub Actions runs on Node 22 and must pass:

1. formatting check;
2. lint;
3. build;
4. TypeScript checks;
5. tests.

CI is added before substantive simulation or API logic.

### Production deployment shape

The eventual production layout is isolated from existing ROCSI services:

```text
Cloudflare / DNS
       |
       v
Apache virtual host: warera-lab.rocsi.eu
       |
       +-- /, assets --> static Vite build
       |
       +-- /api/* ----> 127.0.0.1:3220
                            |
                            +--> Hono API service
                                      |
                                      +--> official documented WarEra API
```

Deployment should follow ROCSI's release/symlink pattern with a dedicated service user, dedicated systemd unit, dedicated directories, and a dedicated Apache virtual host. The API process must use systemd hardening such as `NoNewPrivileges=true`, `PrivateTmp=true`, and `ProtectHome=true`, matching the safer conventions already used by other ROCSI services.

No existing Apache virtual host or service is repurposed for WarEra Lab. No production deployment is part of this scaffold PR.

### Configuration and secrets

The scaffold defines only non-secret runtime configuration such as loopback host, port, and upstream base URL. `.env` files are ignored. The official WarEra API URL may have a safe default, but production values remain overrideable.

If API-token support is ever added after the MVP, credential transit/storage/logging must receive a separate security ADR before implementation.

## Alternatives considered

### Next.js full-stack application

Rejected for the MVP. It would put the entire public site behind an always-on Node process and add server-rendering/runtime complexity that the simulator does not currently require. A static Vite frontend plus a narrow API service gives us a smaller operational footprint and blast radius on the shared VM.

### Browser-direct WarEra API access

Rejected for the MVP. It would distribute raw upstream contracts into browser code, make rate-limit coordination harder, rely on upstream CORS behavior, and make normalization/caching/error policy inconsistent.

### Cloudflare Worker for the API

Not selected initially because the existing VM can host the small service without adding another production platform. Hono's Web-standards API keeps a later worker migration possible if traffic or isolation needs justify it.

### Redis or persistent database

Rejected for the MVP because no accepted user journey requires persistent server state. Adding persistent infrastructure now would increase cost, privacy surface, backups, and operational complexity without improving the first release.

## Consequences

Positive consequences:

- small and reviewable first implementation;
- low additional resource usage on the existing VM;
- one controlled boundary for WarEra API drift and rate limits;
- simulation logic remains deterministic and independently testable;
- no database or credential-handling burden for the first release;
- later portability of the API layer remains feasible.

Trade-offs:

- no server-side rendering in the initial architecture;
- the single API process has an ephemeral cache that is cold after restart;
- initial SEO/content pages are static rather than dynamically rendered;
- if traffic becomes large enough, caching and API capacity may need a separate architecture revision and explicit WarEra coordination.
