# WarEra Lab

WarEra Lab is an independent, open-source toolkit for **WarEra simulation, analytics, and game-data exploration**, developed by ROCSI.

> **Status:** initial implementation scaffold. The first public MVP is defined, but no public application has been released yet.

The planned canonical deployment is **`warera-lab.rocsi.eu`**.

## What we are building

WarEra Lab is intended to combine live game state with transparent what-if modelling. A visitor should be able to import publicly obtainable WarEra data, change assumptions or account/build inputs, compare scenarios, and understand how each result was derived.

The central design rule is:

**WarEra API data describes the current state; WarEra Lab owns the hypothetical simulation model.**

The first public MVP is credential-free and Economy-Lab-first. Its accepted scope is documented in [docs/MVP.md](docs/MVP.md). Post-MVP areas may include combat/build analysis, richer market context, and other documented public game data.

## Data and calculation provenance

Results should distinguish between:

- **Observed:** obtained from the WarEra API or another explicitly identified source.
- **Derived:** calculated from documented or independently verified mechanics.
- **Assumed:** a value or mechanic that is not authoritative or has not yet been verified.
- **Overridden:** a value intentionally changed by the visitor for a scenario.

The official WarEra API documentation at <https://api2.warera.io/docs/> is the primary reference for API capability discovery. Live API inspection and community documentation may supplement it, but assumptions must not be presented as official facts.

## Open development

WarEra Lab is developed publicly in this repository. Architecture and implementation choices that are not yet settled should be tracked through GitHub issues and pull requests rather than silently treated as final decisions.

See [docs/DECISIONS.md](docs/DECISIONS.md) for the current decision record and [ADR 0001](docs/adr/0001-initial-architecture.md) for the initial application architecture.

## Development

The initial scaffold uses Node.js 22, npm workspaces, a Vite + React web application, a small Hono API service, and pure shared TypeScript packages.

```bash
npm ci
npm run verify
```

For local development, run the API and web application in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

The API binds to `127.0.0.1:3220` by default and Vite proxies local `/api` requests to it. The scaffold does **not** call the WarEra API yet.

## Independence and attribution

WarEra Lab is an independent community project. It is **not affiliated with, endorsed by, or operated by WarEra**.

WarEra names, trademarks, game assets, API data, and other third-party materials remain subject to their respective owners' rights and applicable terms. See [NOTICE.md](NOTICE.md).

## Contributing and security

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a substantial change.

Please do not disclose security-sensitive details or credentials in public issues. See [SECURITY.md](SECURITY.md).

## License

The WarEra Lab software is licensed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`). See [LICENSE](LICENSE).

Project branding and third-party names, marks, assets, or data are not granted additional rights by the software license unless explicitly stated.

Initial WarEra Lab work: Copyright © 2026 Cyber Space Initiative SRL (ROCSI). Contributors retain copyright in their contributions unless otherwise agreed.
