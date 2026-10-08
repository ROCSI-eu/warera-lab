# WarEra Lab public API

**Status:** initial MVP contract

WarEra Lab exposes a same-origin API beneath `/api/`. Browser code does not call the WarEra API directly.

All player-search/snapshot requests use **POST with JSON bodies** so player search text and selected player identifiers do not need to appear in access-log query strings. Responses use `Cache-Control: no-store`; upstream operational caching remains inside the WarEra adapter and is represented through normalized freshness metadata.

## `POST /api/players/search`

Request:

```json
{
  "query": "Example"
}
```

The query is trimmed and must be 2–80 characters.

The response contains at most eight normalized player matches:

```json
{
  "data": {
    "query": "Example",
    "matches": [
      {
        "id": "...",
        "username": "Example",
        "countryId": "...",
        "level": 12
      }
    ],
    "truncated": false,
    "freshness": {
      "generatedAt": "2026-10-01T12:00:00.000Z",
      "hasStaleData": false,
      "sources": []
    }
  }
}
```

Search deliberately returns only the fields needed to choose a player. It does not mirror full public profiles.

## `POST /api/players/snapshot`

Request:

```json
{
  "userId": "..."
}
```

The response is the normalized public economy snapshot used by the MVP:

- player identity, level, skill-point totals, and the four Economy Lab skills;
- owned company details needed by Economy Lab;
- only the region and country context relevant to the player/companies;
- explicit context-gap identifiers if an expected region/country is absent upstream;
- per-source freshness state and retrieval timestamps.

WarEra's current documented `company.getCompanies` runtime response is a list of company identifiers. WarEra Lab resolves those identifiers through documented `company.getById` calls before returning the snapshot. The browser never receives the raw company-list payload.

## `POST /api/economy/context`

Request:

```json
{
  "itemCode": "steel"
}
```

This endpoint supplies the browser-facing inputs needed by the Economy Lab planners for the selected company item:

- normalized economy-skill configuration;
- normalized company-upgrade configuration;
- a deterministic `configRevision` fingerprint for the exact normalized skill/upgrade/item configuration used by the planners;
- the selected output item's normalized recipe/configuration when available;
- only live market-price references relevant to the output item and its recipe inputs;
- explicit item/market context gaps;
- freshness for the game-configuration and market-price sources.

The endpoint does not expose the raw upstream game-configuration payload or the complete market-price map.

## `POST /api/market/overview`

Request body: an empty JSON object, `{}`. This is a **demand-driven** snapshot; no
background polling or historical recording is involved.

The response is a compact, sorted selection catalogue from the normalized game
configuration, with each item's `code`, `type`, `rarity`, optional `isTradable`,
and `currentPrice` **only when the price source has a value**. It does not return
the raw game configuration, skills, upgrades, or the entire unfiltered price map.

```json
{
  "data": {
    "items": [
      { "code": "iron", "type": "resource", "rarity": "common", "isTradable": true },
      {
        "code": "steel",
        "type": "resource",
        "rarity": "common",
        "isTradable": true,
        "currentPrice": 10
      }
    ],
    "contextGaps": {
      "itemCodes": [],
      "marketPriceItemCodes": ["iron"]
    },
    "freshness": {
      "generatedAt": "2026-10-08T12:00:00.000Z",
      "hasStaleData": false,
      "sources": []
    }
  }
}
```

`contextGaps.itemCodes` lists codes present in current price data but absent
from the item configuration (not added as synthetic catalogue entries).
`marketPriceItemCodes` lists configured items without a current price. A valid
price of `0` remains `0`; an absent price is **omitted**, never inferred as zero.
Each actual response includes source records for `gameConfig` and `marketPrices`
with retrieval time, age, and cache state.

## `POST /api/market/item`

Request:

```json
{
  "itemCode": "steel"
}
```

The code is trimmed and must be 1–64 characters. The response includes:

- `itemCode` and the selected `item` using the canonical `ItemEconomyConfig`
  shape (including `productionNeeds`), if configured;
- `marketPrices` using the canonical `MarketPriceMap`, restricted to the
  selected output and recipe input codes, with missing values omitted;
- `topOrders` using the canonical `MarketOrderBook`, **only** for a configured
  item not explicitly marked non-tradable; orders are filtered to the requested
  item/side and capped at ten buy and ten sell orders;
- `contextGaps.itemCodes` for output/input codes absent from normalized config,
  `contextGaps.marketPriceItemCodes` for missing output/input prices, and
  `contextGaps.orderBookItemCodes` if the optional order fetch failed;
- `freshness` for actual successful `gameConfig`, `marketPrices`, and (when
  fetched successfully) `marketOrders` sources; order freshness includes the
  requested item code as `subjectId`.

An empty `topOrders` book means the upstream order lookup completed and returned
no applicable orders. Omitted `topOrders` means no order lookup was applicable
(unknown or explicitly non-tradable item), or the lookup failed (then
`orderBookItemCodes` identifies the gap). Missing configuration or price
values are never filled from assumptions. Price/config failures produce the
same sanitized upstream error envelope as other API routes; optional order
failures instead preserve the partial current-state response with an explicit
gap and no fabricated order freshness.

These routes reuse the existing documented `gameConfig.getGameConfig`,
`itemTrading.getPrices`, and `tradingOrder.getTopOrders` adapters, bounded
cache, request deduplication, and rate-limit protections. They do not alter
`/api/economy/context`. Browser clients call them only on user demand; no
persistent history, credentials, or new upstream procedures are introduced.

## Freshness

Browser-facing freshness states are intentionally simple:

- `live` — the adapter made the upstream request for this result;
- `cached` — the normalized result came from the bounded fresh in-memory cache;
- `stale` — an explicitly permitted stale-if-error fallback was used.

The public API does not expose WarEra's raw rate-limit headers.

## Errors

Errors use a stable envelope:

```json
{
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "WarEra is temporarily unavailable. Please retry shortly."
  }
}
```

Current error codes are:

- `INVALID_REQUEST` — malformed or invalid request body (`400`);
- `PLAYER_NOT_FOUND` — selected player does not exist (`404`);
- `UPSTREAM_RATE_LIMITED` — WarEra rate limit / local safety reserve (`503`, with `Retry-After` when known);
- `UPSTREAM_UNAVAILABLE` — network or WarEra 5xx failure (`503`);
- `UPSTREAM_INVALID_RESPONSE` — upstream data failed runtime validation (`502`);
- `UPSTREAM_ERROR` — other upstream rejection (`502`);
- `INTERNAL_ERROR` — unexpected WarEra Lab server failure (`500`).

Raw upstream validation details and error bodies are not returned to browsers.
